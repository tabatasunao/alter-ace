import { describe, expect, it } from 'vitest';
import type { GameData, MissileUnitWeapon, SaberUnitWeapon, ShotUnitWeapon } from '../src/data/types';
import { validateGameData } from '../src/data/validate';
import { leashHeading } from '../src/sim/ai/leash';
import { chooseTarget } from '../src/sim/ai/targetSelection';
import { unitBehaviorFor } from '../src/sim/ai/weapons/registry';
import { ALLY, armyHit, ENEMY, toneOf, type FlyingShot, type Soldier, type Unit } from '../src/sim/entities';
import { UnitActionSystem } from '../src/sim/systems/UnitActionSystem';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { ShieldSystem } from '../src/sim/systems/ShieldSystem';
import { StalkSystem } from '../src/sim/systems/StalkSystem';
import { SoldierAISystem } from '../src/sim/systems/SoldierAISystem';
import type { World } from '../src/sim/World';
import { aceHit, addSoldier, arena, loadTestCatalog, readRawData } from './helpers';
import { tm } from '../src/i18n';

describe('semi-aces', () => {
  const catalog = loadTestCatalog();
  const SEMI_ACES = ['marksman', 'circus', 'duelist'];
  const fire = (world: World, u: Soldier, target: Unit) => unitBehaviorFor(u.weapon).fire({ world, unit: u, weapon: u.weapon, target });
  const run = (world: World, system: { update(w: World, dt: number): void }, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) system.update(world, 1 / 60);
  };

  it('serve in the enemy army only, each with a shield', () => {
    for (const id of SEMI_ACES) {
      expect(catalog.armies.allyMix[id], id).toBeUndefined();
      expect(catalog.armies.enemyMix[id], id).toBeGreaterThan(0);
      expect(catalog.unitClass(id).shield, id).toBeDefined();
    }
  });

  describe('shield', () => {
    const { duration, cooldown } = catalog.unitClass('marksman').shield!;

    function setup() {
      const world = arena(catalog);
      const u = addSoldier(world, 'marksman', ENEMY, 3000, 1000);
      return { world, u, shields: new ShieldSystem(), hit: () => world.combat.damage(u, 10, aceHit(catalog, 'rail')) };
    }

    it('rises on the first hit, blocking it, and blocks everything while up', () => {
      const { world, u, shields, hit } = setup();
      hit();
      expect(u.hp).toBe(u.maxHp);
      expect(u.shieldT).toBe(duration);
      expect(world.fx).toContainEqual(expect.objectContaining({ type: 'hitMarker', result: 'shielded', label: true }));
      run(world, shields, duration - 0.25);
      hit();
      expect(u.hp).toBe(u.maxHp);
    });

    it('drops after its duration and stays down until it recharges', () => {
      const { world, u, shields, hit } = setup();
      hit();
      run(world, shields, duration + 0.25);
      hit();
      expect(u.hp).toBe(u.maxHp - 10);
      run(world, shields, cooldown - duration - 0.5);
      hit();
      expect(u.hp).toBe(u.maxHp - 20);
      run(world, shields, 0.5);
      hit();
      expect(u.hp).toBe(u.maxHp - 20); // recharged: up again
    });

    it('cannot rise while stunned', () => {
      const { u, hit } = setup();
      u.stunT = 1;
      hit();
      expect(u.hp).toBe(u.maxHp - 10);
    });

    it('drops when stunned (an EMP strips it)', () => {
      const { world, u, shields, hit } = setup();
      hit();
      u.stunT = 1;
      shields.update(world, 1 / 60);
      expect(u.shieldT).toBe(0);
      hit();
      expect(u.hp).toBe(u.maxHp - 10);
    });

    it('is only for classes that have one', () => {
      const world = arena(catalog);
      const striker = addSoldier(world, 'striker', ENEMY, 3000, 1000);
      world.combat.damage(striker, 10, aceHit(catalog, 'rail'));
      expect(striker.hp).toBe(striker.maxHp - 10);
    });
  });

  describe('Duelist beam saber', () => {
    const w = catalog.unitWeapon('beamSaber') as SaberUnitWeapon;

    function setup() {
      const world = arena(catalog);
      const duelist = addSoldier(world, 'duelist', ENEMY, 3000, 1000);
      const target = addSoldier(world, 'trooper', ALLY, 3000 - w.range * 0.8, 1000);
      const behind = addSoldier(world, 'trooper', ALLY, 3000 + 60, 1000);
      for (const t of [target, behind]) t.hp = t.maxHp = 1000;
      fire(world, duelist, target);
      return { world, duelist, target, behind };
    }

    it('lunges at the target, slashes it on arrival, then hops back', () => {
      const { world, duelist, target, behind } = setup();
      expect(duelist.action?.holdsAI).toBe(true);
      const startX = duelist.x;
      const actions = new UnitActionSystem();
      const lunge = duelist.action;
      for (let i = 0; i < 60 && duelist.action === lunge; i++) actions.update(world, 1 / 60);
      const reached = duelist.x;
      expect(startX - reached).toBeGreaterThan(w.range * 0.8 - w.stopDistance - 5);
      // A semi-ace's slash on a normal ALTER: the army scale, then the normal ALTER's extra damage from aces.
      expect(1000 - target.hp).toBeCloseTo(w.dmg * catalog.battle.balance.unitVsUnit * catalog.unitClass('trooper').aceHitMul!);
      expect(behind.hp).toBe(1000);
      expect(world.fx).toContainEqual(expect.objectContaining({ type: 'slash', tone: 'semiAce' }));
      expect(duelist.action?.holdsAI).toBe(true); // the hop back
      run(world, actions, w.retreat!.time + 0.05);
      expect(duelist.action).toBeNull();
      expect(duelist.x - reached).toBeCloseTo(w.retreat!.distance, 0);
    });

    it('holds its AI still while lunging, and a stun cuts the lunge with no slash', () => {
      const { world, duelist, target } = setup();
      duelist.cd = 0;
      new SoldierAISystem().update(world, 1 / 60);
      expect(duelist.cd).toBe(0); // did not fire again mid-lunge
      duelist.stunT = 1;
      run(world, new UnitActionSystem(), w.maxLunge + 0.05);
      expect(duelist.action).toBeNull();
      expect(target.hp).toBe(1000);
    });

    describe('dash strike', () => {
      const dash = w.dash!;
      const far = (dash.range + w.range) / 2;

      function dashSetup() {
        const world = arena(catalog);
        const duelist = addSoldier(world, 'duelist', ENEMY, 3000, 1000);
        const target = addSoldier(world, 'trooper', ALLY, 3000 - far, 1000);
        target.hp = target.maxHp = 1000;
        return { world, duelist, target };
      }

      it('reaches past the lunge range: the AI starts it from up to dash.range', () => {
        const { world, duelist, target } = dashSetup();
        expect(unitBehaviorFor(w).reach!(w)).toBe(dash.range);
        duelist.cd = 0;
        duelist.target = target;
        duelist.retarget = 10;
        new SoldierAISystem().update(world, 1 / 60);
        expect(duelist.action?.sightLine?.target).toBe(target);
      });

      it('winds up in place with a sight line that locks, then dashes, slashes harder and leaves a trail', () => {
        const { world, duelist, target } = dashSetup();
        expect(fire(world, duelist, target)).toBe(true);
        expect(duelist.skillCd).toBe(dash.cooldown);
        const actions = new UnitActionSystem();
        run(world, actions, dash.windup - dash.lock - 0.05);
        expect(duelist.x).toBe(3000);
        expect(duelist.action?.sightLine?.locked).toBe(false);
        run(world, actions, 0.1);
        expect(duelist.action?.sightLine?.locked).toBe(true);
        run(world, actions, dash.lock + dash.range / dash.speed);
        expect(3000 - duelist.x).toBeGreaterThan(far - w.stopDistance - w.retreat!.distance - 5);
        expect(1000 - target.hp).toBeCloseTo(dash.dmg * catalog.battle.balance.unitVsUnit * catalog.unitClass('trooper').aceHitMul!);
        expect(world.fx).toContainEqual(expect.objectContaining({ type: 'line', tone: 'semiAce' }));
      });

      it('misses a target that sidesteps after the line locks', () => {
        const { world, duelist, target } = dashSetup();
        fire(world, duelist, target);
        const actions = new UnitActionSystem();
        run(world, actions, dash.windup - dash.lock / 2);
        target.y += 150;
        run(world, actions, dash.lock + dash.range / dash.speed + 0.1);
        expect(target.hp).toBe(1000);
      });

      it('holds fire while its dash recharges, or while the turns at the ace are taken', () => {
        const { world, duelist, target } = dashSetup();
        fire(world, duelist, target);
        duelist.action = null;
        expect(fire(world, duelist, target)).toBe(false);

        const P = world.player!;
        const other = addSoldier(world, 'duelist', ENEMY, P.x + far, P.y);
        for (let i = 0; i < catalog.battle.ai.aceCharges.max; i++) {
          const s = addSoldier(world, 'sentinel', ENEMY, P.x + 300, P.y + 40 * (i + 1));
          fire(world, s, P);
        }
        expect(fire(world, other, P)).toBe(false);
      });
    });
  });

  it('Circus micro-missiles fly a wide fan of weaving paths and still home in', () => {
    const w = catalog.unitWeapon('microMissiles') as MissileUnitWeapon;
    const world = arena(catalog);
    const circus = addSoldier(world, 'circus', ENEMY, 3000, 1000);
    const target = addSoldier(world, 'bulwark', ALLY, 2550, 1000);
    target.hp = target.maxHp = 1e6;
    fire(world, circus, target);
    const missiles = world.shots as FlyingShot[];
    expect(missiles).toHaveLength(w.salvo);
    const phases = new Set(missiles.map((m) => m.homing!.weave!.phase));
    expect(phases.size).toBe(w.salvo);

    // The same salvo without the weave flies smoother: the paths really differ.
    const straight = missiles.map((m) => ({ ...m, homing: { ...m.homing!, weave: undefined } }));
    const projectiles = new ProjectileSystem();
    run(world, projectiles, 0.5);
    const weaving = world.shots as FlyingShot[];
    world.shots = straight;
    run(world, projectiles, 0.5);
    const drift = weaving.reduce((s, m, i) => s + Math.hypot(m.x - world.shots[i]!.x, m.y - world.shots[i]!.y), 0) / weaving.length;
    expect(drift).toBeGreaterThan(5);

    world.shots = [];
    fire(world, circus, target);
    run(world, projectiles, w.life);
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('Circus missiles make one hard turn ahead of their target when close, then fly straight on', () => {
    const w = catalog.unitWeapon('microMissiles') as MissileUnitWeapon;
    const term = w.terminal!;
    const world = arena(catalog);
    const circus = addSoldier(world, 'circus', ENEMY, 3000, 1000);
    const target = addSoldier(world, 'bulwark', ALLY, 2500, 1000);
    target.hp = target.maxHp = 1e6;
    fire(world, circus, target);
    const m = (world.shots as FlyingShot[])[0]!;
    const projectiles = new ProjectileSystem();
    const heading = () => {
      const s = world.shots[0] as FlyingShot;
      return Math.atan2(s.vy, s.vx);
    };
    // Far out: normal homing, at the weapon's own turn rate.
    world.shots = [{ ...m, homing: { ...m.homing! }, x: target.x, y: target.y - term.range * 2, vx: w.speed, vy: 0, life: w.life - 1 }];
    projectiles.update(world, 1 / 60);
    expect(heading()).toBeCloseTo(w.turnRate / 60, 5);

    // Within range, heading east with the target due south: the hard turn starts.
    world.shots = [{ ...m, homing: { ...m.homing! }, x: target.x, y: target.y - term.range / 2, vx: w.speed, vy: 0, life: w.life - 1 }];
    projectiles.update(world, 1 / 60);
    expect(heading()).toBeCloseTo(term.turnRate / 60, 5);
    target.y += 2000; // out of the missile's path: the turn goes on, nothing is hit
    run(world, projectiles, term.time);
    // The correction is over: the target moves away, but the missile keeps its line.
    const committed = heading();
    target.x -= 300;
    run(world, projectiles, 0.1);
    expect(heading()).toBeCloseTo(committed, 6);
  });

  it("Circus missiles aim their hard turn where a moving target is heading", () => {
    const w = catalog.unitWeapon('microMissiles') as MissileUnitWeapon;
    const world = arena(catalog);
    const circus = addSoldier(world, 'circus', ENEMY, 3000, 1000);
    const target = addSoldier(world, 'bulwark', ALLY, 2500, 1000);
    target.vy = 150;
    fire(world, circus, target);
    const m = (world.shots as FlyingShot[])[0]!;
    // Coming straight down from the north, the target moving south: aim ahead of it, not at it.
    world.shots = [{ ...m, homing: { ...m.homing! }, x: target.x - 100, y: target.y - 100, vx: 0, vy: w.speed, life: w.life - 1 }];
    new ProjectileSystem().update(world, 1 / 60);
    const s = world.shots[0] as FlyingShot;
    const toTarget = Math.atan2(100, 100);
    expect(Math.atan2(s.vy, s.vx)).toBeGreaterThan(toTarget);
  });

  it('Circus missiles launch backwards before homing; an ordinary Hornet still launches at its target', () => {
    const world = arena(catalog);
    const circus = addSoldier(world, 'circus', ENEMY, 3000, 1000);
    const hornet = addSoldier(world, 'hornet', ENEMY, 3000, 1400);
    fire(world, circus, addSoldier(world, 'trooper', ALLY, 2500, 1000));
    const swarm = [...world.shots] as FlyingShot[];
    world.shots = [];
    fire(world, hornet, addSoldier(world, 'trooper', ALLY, 2500, 1400));
    const rack = world.shots as FlyingShot[];
    // The target is west, so away is east. The fan is ~180° wide, so its two outermost missiles fly about sideways.
    expect(swarm.filter((m) => m.vx > 0).length).toBeGreaterThanOrEqual(swarm.length - 2);
    expect(swarm.reduce((sum, m) => sum + m.vx, 0)).toBeGreaterThan(0);
    expect(rack.every((m) => m.vx < 0)).toBe(true);
  });

  it('Marksman long beam rifle pierces the line', () => {
    const w = catalog.unitWeapon('longBeamRifle') as ShotUnitWeapon;
    const world = arena(catalog);
    const marksman = addSoldier(world, 'marksman', ENEMY, 3000, 1000);
    fire(world, marksman, addSoldier(world, 'trooper', ALLY, 2400, 1000));
    expect((world.shots[0] as FlyingShot).pierce).toBe(w.pierce);
    expect(world.shots[0]!.kind).toBe('beam');
  });

  describe("stay near the ace (on the player's screen)", () => {
    const think = (world: World) => new SoldierAISystem().update(world, 1 / 60);

    it('a Duelist leaves the ace alone until it finds it', () => {
      const world = arena(catalog);
      const P = world.player!;
      const duelist = addSoldier(world, 'duelist', ENEMY, P.x + 2000, P.y);
      addSoldier(world, 'trooper', ALLY, P.x + 2300, P.y);
      duelist.retarget = 0;
      new StalkSystem().update(world);
      think(world);
      expect(duelist.stalking).toBe(false);
      expect(duelist.target).not.toBe(P);
    });

    it('only the Duelist stalks and rallies: the Marksman and Circus hold their line instead', () => {
      const world = arena(catalog);
      const P = world.player!;
      const near = (id: string) => addSoldier(world, id, ENEMY, P.x + 300, P.y);
      const [marksman, circus, duelist] = ['marksman', 'circus', 'duelist'].map(near);
      new StalkSystem().update(world);
      expect([marksman!.stalking, circus!.stalking, duelist!.stalking]).toEqual([false, false, true]);
      for (const id of ['marksman', 'circus']) {
        expect(catalog.unitClass(id).rally, id).toBeUndefined();
        expect(catalog.unitClass(id).holdLine, id).toBeDefined();
      }
    });

    it('once a Duelist finds the ace, it stalks it wherever it goes', () => {
      const world = arena(catalog);
      const P = world.player!;
      const range = catalog.battle.balance.aceHuntRange;
      const duelist = addSoldier(world, 'duelist', ENEMY, P.x + range - 100, P.y);
      // An ordinary hunter, too far from the Duelist to join its pack.
      const lancer = addSoldier(world, 'lancer', ENEMY, P.x + range - 100, P.y + catalog.unitClass('duelist').rally!.radius + 200);
      new StalkSystem().update(world);
      expect(duelist.stalking).toBe(true);
      expect(lancer.stalking).toBe(false);
      // The ace gets far away: the stalker still targets it and closes in; the ordinary hunter forgets it.
      P.x -= 1500;
      world.grid.rebuild(world.units);
      addSoldier(world, 'trooper', ALLY, duelist.x + 300, duelist.y + 100);
      duelist.retarget = lancer.retarget = 0;
      think(world);
      expect(duelist.target).toBe(P);
      expect(lancer.target).not.toBe(P);
      expect(duelist.vx).toBeLessThan(0); // heading west, after the ace
    });

    describe('packs', () => {
      const rally = catalog.unitClass('duelist').rally!;

      function setup() {
        const world = arena(catalog);
        const P = world.player!;
        const banners: string[] = [];
        world.events.on('banner', ({ msg }) => banners.push(tm(msg)));
        const duelist = addSoldier(world, 'duelist', ENEMY, P.x + 600, P.y);
        const close = Array.from({ length: 30 }, (_, i) => addSoldier(world, 'trooper', ENEMY, duelist.x + 40 + (i % 6) * 30, duelist.y - 75 + Math.floor(i / 6) * 30));
        const otherSemi = addSoldier(world, 'duelist', ENEMY, duelist.x + 900, duelist.y + 2000); // far from the ace: not stalking
        const neighborSemi = addSoldier(world, 'marksman', ENEMY, duelist.x + 20, duelist.y + 20);
        const outside = addSoldier(world, 'trooper', ENEMY, duelist.x + rally.radius + 100, duelist.y);
        new StalkSystem().update(world);
        return { world, P, duelist, close, otherSemi, neighborSemi, outside, banners };
      }

      it('a semi-ace that finds the ace rallies the nearest free units into its pack', () => {
        const { duelist, close, neighborSemi, outside, banners } = setup();
        const pack = close.filter((u) => u.leader === duelist);
        expect(pack.length).toBeGreaterThanOrEqual(rally.min);
        expect(pack.length).toBeLessThanOrEqual(rally.max);
        expect(pack.every((u) => u.stalking)).toBe(true);
        expect(neighborSemi.leader).toBeNull(); // semi-aces lead their own packs
        expect(outside.leader).toBeNull();
        // The nearest ones joined.
        const d = (u: Soldier) => Math.hypot(u.x - duelist.x, u.y - duelist.y);
        const farthestIn = Math.max(...pack.map(d));
        expect(close.filter((u) => !u.leader).every((u) => d(u) >= farthestIn)).toBe(true);
        expect(banners).toContain(`Enemy Duelist and ${pack.length} ALTERs are hunting you`);
      });

      it('pack members hunt the ace at any distance and keep near their leader', () => {
        const { world, P, duelist, close } = setup();
        const member = close.find((u) => u.leader === duelist)!;
        member.x = duelist.x;
        member.y = duelist.y + rally.follow + 300;
        world.grid.rebuild(world.units);
        P.x -= 2000;
        member.retarget = 0;
        new SoldierAISystem().update(world, 1 / 60);
        expect(member.target).toBe(P);
        expect(member.vy).toBeLessThan(0); // back up toward its leader first
      });

      it('break up when their leader dies', () => {
        const { world, duelist, close } = setup();
        const pack = close.filter((u) => u.leader === duelist);
        duelist.alive = false;
        new StalkSystem().update(world);
        expect(pack.every((u) => u.leader === null && !u.stalking)).toBe(true);
      });
    });

    it('only a stalking semi-ace is leashed to the ace, and only beyond its reach', () => {
      const world = arena(catalog);
      const P = world.player!;
      const reach = catalog.unitClass('duelist').nearAce!;
      const far = addSoldier(world, 'duelist', ENEMY, P.x + reach + 200, P.y);
      const near = addSoldier(world, 'duelist', ENEMY, P.x + reach - 50, P.y);
      expect(leashHeading(world, far)).toBeNull(); // not stalking yet
      far.stalking = near.stalking = true;
      const heading = leashHeading(world, far)!;
      expect(heading.x).toBeCloseTo(-1);
      expect(heading.y).toBeCloseTo(0);
      expect(leashHeading(world, near)).toBeNull();
    });
  });

  describe('hold the line (Marksman behind it, Circus on it), facing any way', () => {
    // The fight faces north-south here: the hostile is due north, the Marksman's own line between.
    function line(id: string, depthFromLine: number) {
      const world = arena(catalog);
      world.units = [];
      const hostile = addSoldier(world, 'trooper', ALLY, 3000, 1000);
      // The enemy front: a few teammates 300 south of the hostile.
      for (const dx of [-60, 0, 60]) addSoldier(world, 'trooper', ENEMY, 3000 + dx, 1300);
      const u = addSoldier(world, id, ENEMY, 3000, 1300 + depthFromLine);
      world.grid.rebuild(world.units);
      return { world, u, hostile };
    }

    it('a Marksman ahead of its line backs away from the hostile; far behind it, closes in; in between, fights freely', () => {
      const hold = catalog.unitClass('marksman').holdLine!;
      const ahead = line('marksman', hold.depth - hold.band - 50);
      expect(leashHeading(ahead.world, ahead.u)!.y).toBeCloseTo(1); // south, away from the hostile
      const behind = line('marksman', hold.depth + hold.band + 50);
      expect(leashHeading(behind.world, behind.u)!.y).toBeCloseTo(-1); // north, toward it
      const placed = line('marksman', hold.depth);
      expect(leashHeading(placed.world, placed.u)).toBeNull();
    });

    it('a Circus keeps to the line itself', () => {
      const hold = catalog.unitClass('circus').holdLine!;
      expect(leashHeading(line('circus', hold.depth).world, line('circus', hold.depth).u)).toBeNull();
      const back = line('circus', hold.depth + hold.band + 50);
      expect(leashHeading(back.world, back.u)!.y).toBeCloseTo(-1);
    });

    it('alone, with no teammate near, counts as ahead and backs away', () => {
      const world = arena(catalog);
      world.units = [];
      addSoldier(world, 'trooper', ALLY, 3000, 1000);
      const m = addSoldier(world, 'marksman', ENEMY, 3600, 1000);
      world.grid.rebuild(world.units);
      expect(leashHeading(world, m)!.x).toBeCloseTo(1);
    });
  });

  it('Marksman and Circus shoot the ace whenever it is within their weapon range, allied units otherwise', () => {
    for (const id of ['marksman', 'circus']) {
      const world = arena(catalog);
      const P = world.player!;
      const range = catalog.unitWeapon(catalog.unitClass(id).weapon).range;
      const u = addSoldier(world, id, ENEMY, P.x + range - 20, P.y);
      const ally = addSoldier(world, 'trooper', ALLY, u.x - 100, u.y);
      world.grid.rebuild(world.units);
      expect(chooseTarget(world, u), id).toBe(P);
      // Out of weapon range: the nearest hostile.
      u.x = P.x + range + 60;
      ally.x = u.x - 100;
      world.grid.rebuild(world.units);
      expect(chooseTarget(world, u), id).toBe(ally);
    }
  });

  it('Circus missiles switch to the ace when it comes near them', () => {
    const w = catalog.unitWeapon('microMissiles') as MissileUnitWeapon;
    const world = arena(catalog);
    const P = world.player!;
    const circus = addSoldier(world, 'circus', ENEMY, P.x + 1500, P.y);
    const ally = addSoldier(world, 'trooper', ALLY, P.x + 1000, P.y + 1000);
    fire(world, circus, ally);
    const m = (world.shots as FlyingShot[])[0]!;
    expect(m.target).toBe(ally);
    world.shots = [{ ...m, homing: { ...m.homing! }, x: P.x + w.retargetRadius * 0.5, y: P.y, life: w.life - 1 }];
    new ProjectileSystem().update(world, 1 / 60);
    expect((world.shots[0] as FlyingShot).target).toBe(P);
  });

  it('Marksman and Circus fire hits allied units harder (armyMul); the ace takes the usual share', () => {
    const world = arena(catalog);
    const P = world.player!;
    for (const id of ['longBeamRifle', 'microMissiles']) {
      const w = catalog.unitWeapon(id);
      expect(w.armyMul, id).toBeGreaterThan(1);
      const shooter = addSoldier(world, id === 'longBeamRifle' ? 'marksman' : 'circus', ENEMY, 3000, 1000);
      const trooper = addSoldier(world, 'trooper', ALLY, 2900, 1000);
      const hit = armyHit(shooter, w);
      world.combat.damage(trooper, 10, hit);
      const armor = catalog.armorMultiplier(w.damageType, catalog.unitClass('trooper').armor);
      expect(trooper.maxHp - trooper.hp).toBeCloseTo(10 * catalog.battle.balance.unitVsUnit * w.armyMul! * catalog.unitClass('trooper').aceHitMul! * armor);
      const before = P.hp;
      P.iframes = 0;
      world.combat.damage(P, 10, hit);
      expect(before - P.hp).toBeCloseTo(10 * catalog.battle.balance.aceDamageTaken);
    }
  });

  it('show in their own color (magenta), and so does their fire', () => {
    expect(toneOf(ENEMY, 'army', true)).toBe('semiAce');
    expect(toneOf(ALLY, 'army', true)).toBe('ally');
    expect(toneOf(ENEMY, 'army')).toBe('enemy');
    const world = arena(catalog);
    const marksman = addSoldier(world, 'marksman', ENEMY, 3000, 1000);
    const trooper = addSoldier(world, 'trooper', ENEMY, 3000, 1200);
    fire(world, marksman, addSoldier(world, 'trooper', ALLY, 2400, 1000));
    fire(world, trooper, addSoldier(world, 'trooper', ALLY, 2800, 1200));
    expect(world.shots.map((s) => s.semiAce)).toEqual([true, false]);
  });

  it('rejects a broken shield or weave', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.units.classes.find((c) => c.id === 'marksman')!.shield = { duration: 5, cooldown: 2 };
    (broken.unitWeapons.weapons.find((x) => x.id === 'microMissiles') as MissileUnitWeapon).weave = { amplitude: -1, frequency: 1 };
    const errors = validateGameData(broken);
    expect(errors).toContain('units.marksman.shield: need duration > 0 and cooldown > duration');
    expect(errors).toContain('unitWeapons.microMissiles.weave: amplitude and frequency must be >= 0');
  });

  it('rejects a semi-ace in the allied army', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.armies.allyMix.duelist = 0.01;
    expect(validateGameData(broken)).toContain(
      'armies: semi-ace "duelist" can only serve in the enemy army (allyMix, minimums and fillerClass apply to the allies)',
    );
  });
});
