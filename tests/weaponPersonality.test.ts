import { describe, expect, it } from 'vitest';
import type { MissileWeapon, MortarWeapon, RailWeapon, SaberUnitWeapon, SaberWeapon, ShotgunWeapon, SniperWeapon } from '../src/data/types';
import { saber as unitSaber } from '../src/sim/ai/weapons/behaviors/saber';
import { ENEMY, type WeaponSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { PlayerMovementSystem } from '../src/sim/systems/PlayerMovementSystem';
import { PlayerWeaponSystem } from '../src/sim/systems/PlayerWeaponSystem';
import { UnitActionSystem } from '../src/sim/systems/UnitActionSystem';
import { saber } from '../src/sim/weapons/behaviors/saber';
import { steadyFull, steadyMul } from '../src/sim/weapons/behaviors/rail';
import { sniper } from '../src/sim/weapons/behaviors/sniper';
import { fireWeapon } from '../src/sim/weapons/firing';
import { FollowCameraSystem } from '../src/sim/systems/CameraSystems';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { addSoldier, arena, loadFixtureCatalog } from './helpers';
import { tm } from '../src/i18n';

describe('weapon personalities', () => {
  const catalog = loadFixtureCatalog();

  function armed(weapon: string) {
    const world = arena(catalog, { slots: [weapon] });
    const P = world.player!;
    const target = addSoldier(world, 'bulwark', ENEMY, P.x + 200, P.y);
    target.hp = target.maxHp = 1e9;
    return { world, P, target, slot: P.slots[0] as WeaponSlot, weapons: new PlayerWeaponSystem() };
  }

  it('the Assault Rifle keeps firing during a dash; other weapons hold fire', () => {
    for (const [id, fires] of [['rifle', true], ['beamRifle', false]] as const) {
      const { world, slot, weapons } = armed(id);
      new PlayerCommands(world).dash();
      const ammo = slot.ammo;
      weapons.update(world, 1 / 60);
      expect(slot.ammo < ammo, id).toBe(fires);
    }
  });

  it('the Beam Rifle fires faster the faster the ace moves', () => {
    const still = armed('beamRifle');
    still.weapons.update(still.world, 1 / 60);
    const moving = armed('beamRifle');
    moving.P.vx = moving.P.frame.speed;
    moving.weapons.update(moving.world, 1 / 60);
    const m = moving.slot.def.movingFireInterval!;
    expect(moving.slot.cd / still.slot.cd).toBeCloseTo(m, 2);
  });

  it('the Railgun hits hardest from a standstill, with a full-strength bonus near rest', () => {
    const { P } = armed('rail');
    const w = catalog.weapon('rail') as RailWeapon;
    const s = w.steady!;
    expect(steadyFull(w, P)).toBe(true);
    expect(steadyMul(w, P)).toBeCloseTo(s.still * s.fullBonus);
    P.vx = P.frame.speed * s.fullBelow;
    expect(steadyFull(w, P)).toBe(false);
    expect(steadyMul(w, P)).toBeCloseTo(s.still + (s.moving - s.still) * s.fullBelow);
    P.vx = P.frame.speed;
    expect(steadyMul(w, P)).toBeCloseTo(w.steady!.moving);
    P.vx = P.frame.speed / 2;
    expect(steadyMul(w, P)).toBeCloseTo((w.steady!.still + w.steady!.moving) / 2);
  });

  it('the Railgun fires a slug; a full-strength hit adds its special effect and a brief hit-stop', () => {
    const still = armed('rail');
    still.weapons.update(still.world, 1 / 60);
    expect(still.world.fx).toContainEqual(expect.objectContaining({ type: 'slug', full: true }));
    expect(still.world.impact.freeze).toBe(catalog.battle.impact.railFull.freeze);

    const moving = armed('rail');
    moving.P.vx = moving.P.frame.speed;
    moving.weapons.update(moving.world, 1 / 60);
    expect(moving.world.fx).toContainEqual(expect.objectContaining({ type: 'slug', full: false }));
    expect(moving.world.impact.freeze).toBe(0);
  });

  it('the Shotgun jolts the ace back a fixed distance, then lets it slide, and knocks back each enemy its pellets hit', () => {
    const { world, P, target, slot } = armed('shotgun');
    const w = slot.def as ShotgunWeapon;
    target.x = P.x + 60;
    world.grid.rebuild(world.units);
    fireWeapon(world, P, slot);
    expect(P.jolt).not.toBeNull();
    expect(P.vx).toBeCloseTo(-w.jolt.carry); // the slide that follows
    P.vx = 0; // measure the jolt alone
    const x0 = P.x;
    const move = new PlayerMovementSystem({ read: () => ({ x: 0, y: 0 }) });
    for (let i = 0; i < 10; i++) move.update(world, 1 / 60);
    expect(P.jolt).toBeNull();
    expect(x0 - P.x).toBeCloseTo(w.jolt.distance, 5); // fired toward +x, jolted toward -x
    expect(world.impact.shake).toBe(catalog.battle.impact.shotgun.shake);
    const shots = new ProjectileSystem();
    for (let i = 0; i < 10 && !target.action; i++) shots.update(world, 1 / 60);
    expect(target.action).not.toBeNull(); // knocked back
    const x = target.x;
    const actions = new UnitActionSystem();
    for (let i = 0; i < 5; i++) actions.update(world, 1 / 60);
    expect(target.x).toBeGreaterThan(x);
    expect(w.knock.push).toBeGreaterThan(0);
  });

  it('the Sniper Rifle strikes its target alone for its full damage, from beyond the hunters\' range', () => {
    const { world, P, slot } = armed('sniper');
    const w = slot.def as SniperWeapon;
    expect(w.range).toBeGreaterThan(catalog.battle.balance.aceHuntRange);
    const front = addSoldier(world, 'trooper', ENEMY, P.x + 300, P.y);
    const far = addSoldier(world, 'trooper', ENEMY, P.x + w.range - 20, P.y);
    front.hp = front.maxHp = far.hp = far.maxHp = 1e6;
    sniperFire(world, P, w, far);
    expect(front.hp).toBe(front.maxHp); // the beam goes past what is in front
    expect(far.maxHp - far.hp).toBeGreaterThan(0);
    expect(world.fx.some((f) => f.type === 'heavyBeam')).toBe(true);
  });

  it('the camera zooms out while the Sniper Rifle is active, and back in for other weapons', () => {
    const world = arena(catalog, { slots: ['sniper', 'bazooka'] });
    const camera = new FollowCameraSystem();
    const step = (seconds: number) => {
      for (let i = 0; i < seconds * 60; i++) camera.update(world, 1 / 60);
    };
    const chosen = world.camera.zoomTarget;
    step(2);
    expect(world.camera.zoom).toBeCloseTo(chosen * (catalog.weapon('sniper').viewZoom ?? 1), 3);
    world.player!.active = 1;
    step(2);
    expect(world.camera.zoom).toBeCloseTo(chosen, 3);
  });

  it('the camera closes in during a Beam Saber lunge, then eases back', () => {
    const world = arena(catalog, { slots: ['saber'] });
    const P = world.player!;
    const camera = new FollowCameraSystem();
    const chosen = world.camera.zoomTarget;
    const swing = (catalog.weapon('saber') as SaberWeapon).swingZoom!;
    P.lunge = { remaining: 99, vx: 0, vy: 0, onArrive: () => {} };
    for (let i = 0; i < 120; i++) camera.update(world, 1 / 60);
    expect(world.camera.zoom).toBeCloseTo(chosen * swing, 3);
    P.lunge = null;
    for (let i = 0; i < 180; i++) camera.update(world, 1 / 60);
    expect(world.camera.zoom).toBeCloseTo(chosen, 3);
  });

  it('the Mortar steers its landing point toward a target that moves', () => {
    const { world, P, target, slot } = armed('mortar');
    const w = slot.def as MortarWeapon;
    target.x = P.x + 400;
    fireWeapon(world, P, slot);
    const shell = world.shots.find((s) => s.kind === 'mortar')!;
    expect(shell.kind).toBe('mortar');
    if (shell.kind !== 'mortar') return;
    const x0 = shell.tx;
    target.y += 200; // the target dodges sideways
    const shots = new ProjectileSystem();
    shots.update(world, 0.25);
    expect(shell.ty).toBeGreaterThan(P.y + 1); // the landing point followed
    expect(Math.hypot(shell.tx - x0, shell.ty - P.y)).toBeLessThanOrEqual(w.track * 0.25 + 1e-6);
  });

  it('the Bazooka fires one rocket that homes in, gently', () => {
    const { world, P, slot } = armed('bazooka');
    const w = slot.def as MissileWeapon;
    expect(w.salvo).toBe(1);
    expect(w.turnRate).toBeLessThan((catalog.weapon('missile') as MissileWeapon).turnRate);
    fireWeapon(world, P, slot);
    const rockets = world.shots.filter((s) => s.kind === 'missile');
    expect(rockets).toHaveLength(1);
    expect(rockets[0]!.kind === 'missile' && rockets[0]!.homing).toBeTruthy();
  });

  it('sabers clash: the ace’s slash meets a Duelist mid-lunge, and a Duelist’s slash meets the ace’s drawn saber', () => {
    const world = arena(catalog, { slots: ['saber'] });
    const P = world.player!;
    const duelist = addSoldier(world, 'duelist', ENEMY, P.x + 80, P.y);
    duelist.hp = duelist.maxHp = 1e6;
    duelist.shieldCd = 99; // no shield in the way
    const dw = duelist.weapon as SaberUnitWeapon;
    unitSaber.fire({ world, unit: duelist, weapon: dw, target: P });
    const w = catalog.weapon('saber') as SaberWeapon;
    saber.fire({ world, player: P, weapon: w, targets: [duelist], angle: 0, ammo: Infinity });
    P.lunge!.onArrive();
    expect(duelist.hp).toBe(duelist.maxHp); // not cut
    expect(world.fx.some((f) => f.type === 'callout' && tm(f.msg) === 'CLASH')).toBe(true);
    expect(P.vx).toBeLessThan(0); // bounced away
    expect(duelist.action?.blade).not.toBe(true); // its lunge is over: knocked back

    // The Duelist's slash on the ace with its saber drawn clashes too; with a gun out, it cuts.
    for (const [slots, clashes] of [[['saber'], true], [['bazooka'], false]] as const) {
      const w2 = arena(catalog, { slots: [...slots] });
      const Q = w2.player!;
      Q.iframes = 0;
      const d2 = addSoldier(w2, 'duelist', ENEMY, Q.x + 60, Q.y);
      unitSaber.fire({ world: w2, unit: d2, weapon: d2.weapon as SaberUnitWeapon, target: Q });
      const hp = Q.hp;
      const actions = new UnitActionSystem();
      for (let i = 0; i < 30 && d2.action?.blade; i++) actions.update(w2, 1 / 60);
      expect(Q.hp === hp, slots[0]).toBe(clashes);
      expect(w2.fx.some((f) => f.type === 'callout' && tm(f.msg) === 'CLASH'), slots[0]).toBe(clashes);
    }
  });
});

function sniperFire(world: Parameters<typeof sniper.fire>[0]['world'], P: Parameters<typeof sniper.fire>[0]['player'], w: SniperWeapon, target: Parameters<typeof sniper.fire>[0]['targets'][number]): void {
  sniper.fire({ world, player: P, weapon: w, targets: [target], angle: Math.atan2(target.y - P.y, target.x - P.x), ammo: w.mag ?? Infinity });
}
