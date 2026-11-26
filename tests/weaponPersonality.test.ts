import { describe, expect, it } from 'vitest';
import type { BreachWeapon, RailWeapon, SaberUnitWeapon, SaberWeapon } from '../src/data/types';
import { saber as unitSaber } from '../src/sim/ai/weapons/behaviors/saber';
import { ENEMY, type WeaponSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { PlayerWeaponSystem } from '../src/sim/systems/PlayerWeaponSystem';
import { UnitActionSystem } from '../src/sim/systems/UnitActionSystem';
import { saber } from '../src/sim/weapons/behaviors/saber';
import { steadyMul } from '../src/sim/weapons/behaviors/rail';
import { fireWeapon } from '../src/sim/weapons/firing';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('weapon personalities', () => {
  const catalog = loadTestCatalog();

  function armed(weapon: string) {
    const world = arena(catalog, { slots: [weapon, 'repair'] });
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

  it('the Railgun hits hardest from a standstill', () => {
    const { P } = armed('rail');
    const w = catalog.armament('rail') as RailWeapon;
    expect(steadyMul(w, P)).toBe(w.steady!.still);
    P.vx = P.frame.speed;
    expect(steadyMul(w, P)).toBeCloseTo(w.steady!.moving);
    P.vx = P.frame.speed / 2;
    expect(steadyMul(w, P)).toBeCloseTo((w.steady!.still + w.steady!.moving) / 2);
  });

  it('the Gatling spins up while it keeps firing, spins down when it stops, and overheats then cools', () => {
    const { world, slot, weapons } = armed('gatling');
    const spin = slot.def.spin!;
    for (let i = 0; i < Math.round(spin.upTime * 60 * 0.5); i++) weapons.update(world, 1 / 60);
    expect(slot.spin).toBeGreaterThan(0.3);
    expect(slot.spin).toBeLessThan(1);
    let guard = 0;
    while (slot.reloadT <= 0 && guard++ < 2000) weapons.update(world, 1 / 60);
    expect(slot.reloadT).toBeGreaterThan(0); // overheated
    world.units = [world.player!]; // stop shooting while it cools
    world.grid.rebuild(world.units);
    for (let i = 0; i < 60 * (slot.def.reload + 0.1); i++) weapons.update(world, 1 / 60);
    expect(slot.ammo).toBe(slot.def.mag); // cooled down

    const idle = armed('gatling');
    idle.slot.ammo = 10;
    idle.slot.spin = 1;
    idle.slot.sinceShot = 10;
    idle.world.units = [idle.P]; // nothing to shoot
    idle.world.grid.rebuild(idle.world.units);
    idle.weapons.update(idle.world, 0.5);
    expect(idle.slot.spin).toBeLessThan(1);
    expect(idle.slot.ammo).toBeGreaterThan(10); // heat falls when it rests
  });

  it('the Breach Cannon blasts on every blastEvery-th shot, throwing enemies back and kicking the ace away', () => {
    const { world, P, target, slot } = armed('breach');
    const w = slot.def as BreachWeapon;
    target.x = P.x + w.blast.offset;
    world.grid.rebuild(world.units);
    for (let i = 1; i < w.blastEvery; i++) fireWeapon(world, P, slot);
    expect(target.action).toBeNull();
    expect(P.vx).toBe(0);
    fireWeapon(world, P, slot);
    expect(target.action).not.toBeNull(); // knocked back
    expect(P.vx).toBeCloseTo(-w.recoil);
    const x = target.x;
    const actions = new UnitActionSystem();
    for (let i = 0; i < 10; i++) actions.update(world, 1 / 60);
    expect(target.x).toBeGreaterThan(x);
  });

  it('sabers clash: the ace’s slash meets a Duelist mid-lunge, and a Duelist’s slash meets the ace’s drawn saber', () => {
    const world = arena(catalog, { slots: ['saber', 'repair'] });
    const P = world.player!;
    const duelist = addSoldier(world, 'duelist', ENEMY, P.x + 80, P.y);
    duelist.hp = duelist.maxHp = 1e6;
    duelist.shieldCd = 99; // no shield in the way
    const dw = duelist.weapon as SaberUnitWeapon;
    unitSaber.fire({ world, unit: duelist, weapon: dw, target: P });
    const w = catalog.armament('saber') as SaberWeapon;
    saber.fire({ world, player: P, weapon: w, targets: [duelist], angle: 0, ammo: Infinity });
    P.lunge!.onArrive();
    expect(duelist.hp).toBe(duelist.maxHp); // not cut
    expect(world.fx.some((f) => f.type === 'callout' && f.text === 'CLASH')).toBe(true);
    expect(P.vx).toBeLessThan(0); // bounced away
    expect(duelist.action?.blade).not.toBe(true); // its lunge is over: knocked back

    // The Duelist's slash on the ace with its saber drawn clashes too; with a gun out, it cuts.
    for (const [slots, clashes] of [[['saber', 'repair'], true], [['rifle', 'repair'], false]] as const) {
      const w2 = arena(catalog, { slots: [...slots] });
      const Q = w2.player!;
      Q.iframes = 0;
      const d2 = addSoldier(w2, 'duelist', ENEMY, Q.x + 60, Q.y);
      unitSaber.fire({ world: w2, unit: d2, weapon: d2.weapon as SaberUnitWeapon, target: Q });
      const hp = Q.hp;
      const actions = new UnitActionSystem();
      for (let i = 0; i < 30 && d2.action?.blade; i++) actions.update(w2, 1 / 60);
      expect(Q.hp === hp, slots[0]).toBe(clashes);
      expect(w2.fx.some((f) => f.type === 'callout' && f.text === 'CLASH'), slots[0]).toBe(clashes);
    }
  });
});
