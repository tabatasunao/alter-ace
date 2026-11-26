import { describe, expect, it } from 'vitest';
import type { BulletWeapon, MissileWeapon } from '../src/data/types';
import { ENEMY, type FlyingShot, type WeaponSlot } from '../src/sim/entities';
import { NO_INPUT } from '../src/sim/input';
import { motionFor } from '../src/sim/projectiles/motions';
import { PlayerMovementSystem } from '../src/sim/systems/PlayerMovementSystem';
import { PlayerWeaponSystem } from '../src/sim/systems/PlayerWeaponSystem';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { fireWeapon } from '../src/sim/weapons/firing';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('weapons', () => {
  const catalog = loadTestCatalog();

  it('every weapon in the data fires at a target in range', () => {
    for (const weapon of catalog.weapons) {
      const world = arena(catalog, { slots: [weapon.id, 'repair', 'emp', 'decoy'] });
      const P = world.player!;
      addSoldier(world, 'trooper', ENEMY, P.x + Math.min(100, weapon.range * 0.5), P.y);
      const slot = P.slots[0] as WeaponSlot;
      expect(fireWeapon(world, P, slot), weapon.id).toBe(true);
    }
  });

  it('does nothing without a target in range', () => {
    const world = arena(catalog);
    const P = world.player!;
    addSoldier(world, 'trooper', ENEMY, P.x + 2000, P.y);
    const slot = P.slots[0] as WeaponSlot;
    expect(fireWeapon(world, P, slot)).toBe(false);
    expect(slot.ammo).toBe(slot.def.mag);
    expect(world.shots).toHaveLength(0);
  });

  it('Railgun hits everything on its line and nothing beside it', () => {
    const world = arena(catalog, { slots: ['rail', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const line = [100, 300, 600].map((dx) => addSoldier(world, 'trooper', ENEMY, P.x + dx, P.y));
    const beside = addSoldier(world, 'trooper', ENEMY, P.x + 300, P.y + 80);
    const slot = P.slots[0] as WeaponSlot;
    fireWeapon(world, P, slot);
    for (const u of line) expect(u.alive).toBe(false);
    expect(beside.hp).toBe(beside.maxHp);
    expect(slot.ammo).toBe(slot.def.mag! - 1);
  });

  it('Assault Rifle rounds pierce through to the next units in line', () => {
    const world = arena(catalog, { slots: ['rifle', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const rifle = catalog.armament('rifle') as BulletWeapon;
    const line = [120, 160, 200, 240].map((dx) => addSoldier(world, 'bulwark', ENEMY, P.x + dx, P.y));
    for (const u of line) u.hp = u.maxHp = 1e6;
    const slot = P.slots[0] as WeaponSlot;
    // The rifle's spread (±0.025 rad, about ±6 units out here) stays inside a Bulwark's hit radius.
    fireWeapon(world, P, slot);
    const projectiles = new ProjectileSystem();
    for (let i = 0; i < 30; i++) projectiles.update(world, 1 / 60);
    const hit = line.filter((u) => u.hp < u.maxHp);
    expect(hit).toHaveLength(rifle.pierce! + 1);
  });

  it('Missile Pod missiles launch backwards, then turn and home in', () => {
    const world = arena(catalog, { slots: ['missile', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const w = catalog.armament('missile') as MissileWeapon;
    const target = addSoldier(world, 'bulwark', ENEMY, P.x + 400, P.y);
    target.hp = target.maxHp = 1e6;
    fireWeapon(world, P, P.slots[0] as WeaponSlot);
    const missiles = world.shots as FlyingShot[];
    expect(missiles.every((m) => m.vx < 0)).toBe(true); // all fly away from the target at first
    const projectiles = new ProjectileSystem();
    const launchSteps = Math.floor(w.homingDelay * 60) - 1;
    for (let i = 0; i < launchSteps; i++) projectiles.update(world, 1 / 60);
    expect(missiles.every((m) => m.vx < 0)).toBe(true); // no homing during the launch phase
    for (let i = 0; i < 60 * 1.5; i++) projectiles.update(world, 1 / 60);
    expect(target.hp).toBeLessThan(target.maxHp); // they turned and hit
  });

  it("Missile Pod missiles whose target dies fan out across nearby enemies (NPC missiles still take the nearest)", () => {
    const world = arena(catalog);
    const dead = addSoldier(world, 'trooper', ENEMY, 3000, 1000);
    const nearby = Array.from({ length: 6 }, (_, i) => addSoldier(world, 'trooper', ENEMY, 3060 + i * 25, 1000 + (i % 2) * 40));
    dead.alive = false;
    const missile = (spread: boolean): FlyingShot => ({
      kind: 'missile', x: 2990, y: 1000, vx: 300, vy: 0, team: 0, dmg: 1, life: 2, r: 3, pierce: 0, hits: null,
      splash: 0, splashDmg: 0, homing: { turnRate: 6, acceleration: 0, retargetRadius: 450, spread }, target: dead,
      maxSpeed: 300, src: 'player', wid: 'missile', dtype: 'blast',
    });
    world.shots = Array.from({ length: 8 }, () => missile(true));
    new ProjectileSystem().update(world, 1 / 60);
    const spreadTargets = new Set((world.shots as FlyingShot[]).map((m) => m.target));
    expect(spreadTargets.size).toBeGreaterThan(2);
    expect([...spreadTargets].every((t) => t && nearby.includes(t as never))).toBe(true);

    world.shots = Array.from({ length: 8 }, () => missile(false));
    new ProjectileSystem().update(world, 1 / 60);
    expect(new Set((world.shots as FlyingShot[]).map((m) => m.target)).size).toBe(1);
  });

  it('Missile Pod launches one missile per target from the top of the ranking', () => {
    const world = arena(catalog, { slots: ['missile', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const targets = Array.from({ length: 8 }, (_, i) => addSoldier(world, 'trooper', ENEMY, P.x + 100 + i * 40, P.y + 60));
    fireWeapon(world, P, P.slots[0] as WeaponSlot);
    const { salvo } = catalog.armament('missile') as MissileWeapon;
    const locked = world.shots.map((s) => (s.kind === 'missile' ? s.target : null));
    expect(locked).toHaveLength(salvo);
    expect(new Set(locked).size).toBe(salvo);
    expect(targets.slice(0, salvo)).toEqual(expect.arrayContaining(locked));
  });

  it('auto-fires, empties the magazine, reloads with the frame multiplier, then refills', () => {
    const world = arena(catalog, { frame: 'quickdraw', slots: ['beamRifle', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const target = addSoldier(world, 'bulwark', ENEMY, P.x + 200, P.y);
    target.hp = target.maxHp = 1e9;
    const weapons = new PlayerWeaponSystem();
    const slot = P.slots[0] as WeaponSlot;
    const mag = slot.def.mag!;
    let guard = 0;
    while (slot.reloadT <= 0 && guard++ < 1000) weapons.update(world, 1 / 60);
    expect(slot.ammo).toBe(0);
    expect(slot.reloadT).toBeCloseTo(slot.def.reload * P.frame.reloadMul, 1);
    for (let i = 0; i < 60 * slot.def.reload; i++) weapons.update(world, 1 / 60);
    expect(slot.ammo).toBeGreaterThan(0);
    expect(slot.ammo).toBeLessThanOrEqual(mag);
  });

  it("Plasma Mortar's shell keeps x, y on its ground point while it flies", () => {
    const world = arena(catalog, { slots: ['mortar', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    addSoldier(world, 'bulwark', ENEMY, P.x + 400, P.y);
    fireWeapon(world, P, P.slots[0] as WeaponSlot);
    const shell = world.shots[0]!;
    if (shell.kind !== 'mortar') throw new Error('expected a mortar shell');
    motionFor(shell).step(shell, shell.flight / 2, world);
    expect(shell.x).toBeCloseTo((shell.sx + shell.tx) / 2);
    expect(shell.y).toBeCloseTo((shell.sy + shell.ty) / 2);
  });

  it('Beam Saber lunges (no ammo) and slashes the target when the lunge ends', () => {
    const world = arena(catalog, { slots: ['saber', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    const target = addSoldier(world, 'trooper', ENEMY, P.x + 120, P.y);
    const slot = P.slots[0] as WeaponSlot;
    fireWeapon(world, P, slot);
    expect(P.lunge).not.toBeNull();
    expect(slot.ammo).toBe(Infinity);
    const movement = new PlayerMovementSystem(NO_INPUT);
    for (let i = 0; i < 20 && P.lunge; i++) movement.update(world, 1 / 60);
    expect(target.alive).toBe(false);
    expect(world.fx.some((f) => f.type === 'slash')).toBe(true);
  });
});
