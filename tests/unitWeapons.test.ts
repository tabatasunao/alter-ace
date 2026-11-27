import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/random';
import type { LanceUnitWeapon, MissileUnitWeapon, ShotUnitWeapon } from '../src/data/types';
import { leadAngle } from '../src/sim/ai/aim';
import { unitBehaviorFor } from '../src/sim/ai/weapons/registry';
import { ALLY, ENEMY, type FlyingShot, type Soldier, type Unit } from '../src/sim/entities';
import { UnitActionSystem } from '../src/sim/systems/UnitActionSystem';
import { SoldierAISystem } from '../src/sim/systems/SoldierAISystem';
import { World } from '../src/sim/World';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('unit weapons (AI armies)', () => {
  const catalog = loadTestCatalog();

  const fire = (world: World, u: Soldier, target: Unit) =>
    unitBehaviorFor(u.weapon).fire({ world, unit: u, weapon: u.weapon, target });
  const flying = (world: World) => world.shots.filter((s): s is FlyingShot => s.kind !== 'mortar');

  it('every unit weapon in the data fires at a target in range', () => {
    for (const w of catalog.unitWeapons) {
      const world = arena(catalog);
      const u = addSoldier(world, 'trooper', ENEMY, 3000, 1000, w.id);
      const target = addSoldier(world, 'trooper', ALLY, 3000 - w.range * 0.5, 1000);
      fire(world, u, target);
      expect(world.shots.length > 0 || u.action !== null, w.id).toBe(true);
    }
  });

  it('shot: fires pellets of its projectile kind, typed and credited to the army', () => {
    const world = arena(catalog);
    const u = addSoldier(world, 'breacher', ENEMY, 3000, 1000, 'scattergun');
    const target = addSoldier(world, 'trooper', ALLY, 2900, 1000);
    fire(world, u, target);
    const w = catalog.unitWeapon('scattergun') as ShotUnitWeapon;
    expect(flying(world)).toHaveLength(w.pellets!);
    expect(flying(world).every((s) => s.kind === 'bullet' && s.src === 'army' && s.dtype === 'kinetic' && s.team === ENEMY)).toBe(true);

    const beamWorld = arena(catalog);
    const b = addSoldier(beamWorld, 'striker', ENEMY, 3000, 1000, 'beamPistol');
    fire(beamWorld, b, addSoldier(beamWorld, 'trooper', ALLY, 2800, 1000));
    expect(flying(beamWorld).map((s) => [s.kind, s.dtype])).toEqual([['beam', 'beam']]);
  });

  it('shot: aims ahead of a moving target by its lead', () => {
    const target = { x: 400, y: 0, vx: 0, vy: 200 } as Unit;
    const direct = Math.atan2(target.y, target.x);
    expect(leadAngle(0, 0, target, 400, 0)).toBeCloseTo(direct);
    const full = leadAngle(0, 0, target, 400, 1);
    const half = leadAngle(0, 0, target, 400, 0.5);
    expect(full).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(direct);
    // Full lead meets the target: when the shot reaches x = 400, the target has moved to about the same y.
    const time = 400 / (400 * Math.cos(full));
    expect(400 * Math.sin(full) * time).toBeCloseTo(200 * time, 6);
  });

  it('missile: launches a homing salvo locked on the target, with splash', () => {
    const world = arena(catalog);
    const u = addSoldier(world, 'lancer', ENEMY, 3000, 1000, 'missileRack');
    const target = addSoldier(world, 'trooper', ALLY, 2500, 1000);
    fire(world, u, target);
    const w = catalog.unitWeapon('missileRack') as MissileUnitWeapon;
    const shots = flying(world);
    expect(shots).toHaveLength(w.salvo);
    expect(shots.every((s) => s.kind === 'missile' && s.target === target && s.homing !== null && s.splash === w.splash)).toBe(true);
    expect(shots.every((s) => s.dtype === 'blast')).toBe(true);
  });

  describe('lance (charged beam)', () => {
    const w = catalog.unitWeapon('beamLance') as LanceUnitWeapon;
    const steps = (seconds: number) => Math.round(seconds * 60);

    function setup() {
      const world = arena(catalog);
      const u = addSoldier(world, 'lancer', ENEMY, 3000, 1000, 'beamLance');
      const onLine = addSoldier(world, 'bulwark', ALLY, 2600, 1000);
      const behind = addSoldier(world, 'bulwark', ALLY, 2400, 1000);
      const beside = addSoldier(world, 'bulwark', ALLY, 2500, 1080);
      for (const t of [onLine, behind, beside]) t.hp = t.maxHp = 1000;
      fire(world, u, onLine);
      return { world, u, onLine, behind, beside, charges: new UnitActionSystem() };
    }

    it('charges first, then hits everything on its line at once', () => {
      const { world, u, onLine, behind, beside, charges } = setup();
      expect(u.action?.sightLine).toBeTruthy();
      for (let i = 0; i < steps(w.charge) - 2; i++) charges.update(world, 1 / 60);
      expect(onLine.hp).toBe(1000);
      for (let i = 0; i < 4; i++) charges.update(world, 1 / 60);
      expect(u.action).toBeNull();
      const { unitVsUnit } = catalog.battle.balance;
      // Beam vs heavy plate: x1.5.
      expect(1000 - onLine.hp).toBeCloseTo(w.dmg * unitVsUnit * 1.5);
      expect(1000 - behind.hp).toBeCloseTo(w.dmg * unitVsUnit * 1.5);
      expect(beside.hp).toBe(1000);
      expect(world.fx).toContainEqual(expect.objectContaining({ type: 'line', tone: 'enemy' }));
    });

    it('tracks the target while charging, then locks the line', () => {
      const { world, u, onLine, charges } = setup();
      onLine.vy = 100;
      charges.update(world, 1 / 60);
      const tracking = u.action!.sightLine!.angle;
      expect(tracking).toBeLessThan(Math.PI); // swung toward +y (the target is to the west, at angle π)
      for (let i = 0; i < steps(w.charge - w.lock) + 1; i++) charges.update(world, 1 / 60);
      const locked = u.action!.sightLine!.angle;
      onLine.vy = -300;
      onLine.y = 900;
      charges.update(world, 1 / 60);
      expect(u.action!.sightLine!.angle).toBe(locked);
    });

    it('is canceled by a stun', () => {
      const { world, u, onLine, charges } = setup();
      u.stunT = 1;
      charges.update(world, 1 / 60);
      expect(u.action).toBeNull();
      for (let i = 0; i < steps(w.charge) + 5; i++) charges.update(world, 1 / 60);
      expect(onLine.hp).toBe(1000);
    });
  });

  it('the AI fires its own weapon at its own range', () => {
    const world = arena(catalog);
    const beam = addSoldier(world, 'prism', ENEMY, 3000, 1000, 'beamCannon');
    const rifle = addSoldier(world, 'trooper', ENEMY, 3000, 1400, 'assaultRifle');
    // 420 away: inside the beam cannon's range, outside the assault rifle's.
    addSoldier(world, 'trooper', ALLY, 2580, 1000);
    addSoldier(world, 'trooper', ALLY, 2580, 1400);
    beam.cd = rifle.cd = 0;
    new SoldierAISystem().update(world, 1 / 60);
    expect(beam.cd).toBeGreaterThan(0);
    expect(rifle.cd).toBeLessThanOrEqual(0);
    expect(flying(world).map((s) => s.kind)).toEqual(['beam']);
  });

  it('a class with kiteDistance backs off from a target that close', () => {
    const world = arena(catalog);
    const lancer = addSoldier(world, 'lancer', ENEMY, 3000, 1000, 'artillery');
    addSoldier(world, 'trooper', ALLY, 3000 - catalog.unitClass('lancer').kiteDistance! + 50, 1000);
    lancer.retarget = 0;
    new SoldierAISystem().update(world, 1 / 60);
    expect(lancer.vx).toBeGreaterThan(0); // moving east, away from the target
  });

  it('every class deploys with its one weapon; enemy units use the enemy weapon where the class has one', () => {
    const world = new World(catalog, new SeededRandom(1), 'battle');
    for (const c of catalog.classes) {
      expect(world.factory.soldier(c, ALLY, 0, 0).weapon).toBe(catalog.unitWeapon(c.weapon));
      expect(world.factory.soldier(c, ENEMY, 0, 0).weapon).toBe(catalog.unitWeapon(c.enemyWeapon ?? c.weapon));
    }
    expect(catalog.unitClass('commander').enemyWeapon).toBe('megaBeam');
  });

  it('the mega-beam hits units well beside its line that a Beam lance misses', () => {
    const hitBeside = (weaponId: string) => {
      const world = arena(catalog);
      const u = addSoldier(world, 'lancer', ENEMY, 3000, 1000, weaponId);
      const target = addSoldier(world, 'bulwark', ALLY, 2600, 1000);
      const beside = addSoldier(world, 'bulwark', ALLY, 2500, 1020);
      for (const t of [target, beside]) t.hp = t.maxHp = 1000;
      fire(world, u, target);
      const charges = new UnitActionSystem();
      for (let i = 0; i < 180 && u.action; i++) charges.update(world, 1 / 60);
      return beside.hp < 1000;
    };
    expect(hitBeside('megaBeam')).toBe(true);
    expect(hitBeside('beamLance')).toBe(false);
  });
});
