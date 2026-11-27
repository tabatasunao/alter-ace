import { describe, expect, it, vi } from 'vitest';
import type { CommandSink } from '../src/input/commands';
import { defaultKeys } from '../src/game/settings';
import { KeyMap } from '../src/input/keymap';
import { KeyboardInput } from '../src/input/KeyboardInput';
import { aceHit, ENEMY, type FlyingShot, type WeaponSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { firesAllWeapons } from '../src/sim/statuses';
import { PlayerStatusSystem } from '../src/sim/systems/PlayerStatusSystem';
import { PlayerWeaponSystem } from '../src/sim/systems/PlayerWeaponSystem';
import { ReleaseSystem } from '../src/sim/systems/ReleaseSystem';
import type { World } from '../src/sim/World';
import { addSoldier, ARMY_HIT, arena, chargedArena, loadFixtureCatalog } from './helpers';

describe('super release', () => {
  const catalog = loadFixtureCatalog();
  const sr = catalog.battle.player.superRelease;
  const { duration } = sr;
  const loadout = { slots: ['rifle', 'missile', 'shotgun', 'bazooka'] };

  function setup() {
    const world = chargedArena(catalog, loadout);
    const P = world.player!;
    const target = addSoldier(world, 'bulwark', ENEMY, P.x + 200, P.y);
    target.hp = target.maxHp = 1e9;
    return { world, P, commands: new PlayerCommands(world) };
  }
  const ammo = (P: { slots: WeaponSlot[] }) => P.slots.map((s) => s.ammo);

  it('fires only the active weapon normally', () => {
    const { world, P } = setup();
    const before = ammo(P);
    new PlayerWeaponSystem().update(world, 1 / 60);
    const after = ammo(P);
    expect(after[0]).toBeLessThan(before[0] as number);
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it('fires every weapon hardpoint at once while it runs', () => {
    const { world, P, commands } = setup();
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(true);
    const before = ammo(P);
    new PlayerWeaponSystem().update(world, 1 / 60);
    const after = ammo(P);
    for (const i of [0, 1, 2, 3]) expect(after[i], `slot ${i}`).toBeLessThan(before[i] as number);
    expect(P.statuses.map((s) => s.id)).toEqual(['superRelease']);
  });

  it('fires the Shotgun twice as fast while it runs (fullArmsFireInterval)', () => {
    const { world, P, commands } = setup();
    const shotgun = P.slots[2]!;
    expect(shotgun.def.fullArmsFireInterval).toBe(0.5);
    P.active = 2;
    new PlayerWeaponSystem().update(world, 1 / 60);
    const normal = shotgun.cd;
    shotgun.cd = 0;
    shotgun.ammo = shotgun.def.mag!;
    commands.superRelease();
    new PlayerWeaponSystem().update(world, 1 / 60);
    expect(shotgun.cd).toBeCloseTo(normal * 0.5);
    expect(catalog.weapon('saber').fullArmsFireInterval).toBe(0.5);
  });

  it('opens with a fireworks burst from every weapon, even with no enemy around, using no ammo', () => {
    const world = chargedArena(catalog, loadout); // just the ace
    const P = world.player!;
    const before = ammo(P);
    new PlayerCommands(world).superRelease();
    const { openingBurst } = catalog.battle.player.superRelease;
    const expected = (id: string, perShot = 1) => {
      const w = catalog.weapon(id) as { interval: number };
      return Math.max(1, Math.round((openingBurst * perShot) / (w.interval * P.frame.rateMul)));
    };
    const salvo = (catalog.weapon('missile') as { salvo: number }).salvo;
    const shots = world.shots as FlyingShot[];
    expect(shots.filter((s) => s.wid === 'rifle')).toHaveLength(expected('rifle'));
    expect(shots.filter((s) => s.wid === 'missile')).toHaveLength(expected('missile', salvo));
    const pellets = (catalog.weapon('shotgun') as { pellets: number }).pellets;
    expect(shots.filter((s) => s.wid === 'shotgun')).toHaveLength(expected('shotgun', pellets));
    expect(shots.filter((s) => s.wid === 'bazooka')).toHaveLength(expected('bazooka'));
    // A wild spray: rounds head every way, at varied speeds, not in a tidy ring.
    const speeds = new Set(shots.filter((s) => s.wid === 'rifle').map((s) => Math.round(Math.hypot(s.vx, s.vy))));
    expect(speeds.size).toBeGreaterThan(5);
    for (const pick of [(s: FlyingShot) => s.vx > 0, (s: FlyingShot) => s.vx < 0, (s: FlyingShot) => s.vy > 0, (s: FlyingShot) => s.vy < 0]) {
      expect(shots.some(pick)).toBe(true);
    }
    expect(ammo(P)).toEqual(before);
  });

  it('sends burst missiles after different enemies when there are enough in range', () => {
    const world = chargedArena(catalog, loadout);
    const P = world.player!;
    const enemies = Array.from({ length: 12 }, (_, i) => addSoldier(world, 'trooper', ENEMY, P.x + 200 + (i % 4) * 60, P.y - 120 + Math.floor(i / 4) * 120));
    new PlayerCommands(world).superRelease();
    const missiles = (world.shots as FlyingShot[]).filter((s) => s.kind === 'missile');
    expect(missiles.length).toBeGreaterThan(enemies.length);
    const firstRound = missiles.slice(0, enemies.length).map((m) => m.target);
    expect(new Set(firstRound).size).toBe(enemies.length); // one each before any doubles up
  });

  it('bursts a saber as a full-circle slash, and mortar shells at random spots around the ace', () => {
    const world = chargedArena(catalog, { slots: ['saber', 'mortar', 'rifle', 'bazooka'] });
    const P = world.player!;
    const behind = addSoldier(world, 'bulwark', ENEMY, P.x - 60, P.y);
    behind.hp = behind.maxHp = 1e6;
    new PlayerCommands(world).superRelease();
    expect(behind.hp).toBeLessThan(behind.maxHp);
    const shells = world.shots.filter((s) => s.kind === 'mortar');
    expect(shells.length).toBeGreaterThan(0);
    const range = (catalog.weapon('mortar') as { range: number }).range;
    for (const s of shells) {
      if (s.kind !== 'mortar') continue;
      const d = Math.hypot(s.tx - P.x, s.ty - P.y);
      expect(d).toBeGreaterThanOrEqual(range * 0.3 - 1e-6);
      expect(d).toBeLessThanOrEqual(range * 0.8 + 1e-6);
    }
  });

  it('keeps the Beam Rifle and Railgun bursts in the front arc, where the ace is facing', () => {
    const world = chargedArena(catalog, { slots: ['beamRifle', 'rail', 'sniper', 'rifle'] });
    const P = world.player!;
    P.facing = 1; // radians
    const behind = addSoldier(world, 'bulwark', ENEMY, P.x - Math.cos(1) * 300, P.y - Math.sin(1) * 300);
    behind.hp = behind.maxHp = 1e6;
    new PlayerCommands(world).superRelease();
    const half = ((catalog.weapon('beamRifle') as { burstArc: number }).burstArc * Math.PI) / 360;
    const beams = (world.shots as FlyingShot[]).filter((s) => s.kind === 'beam');
    expect(beams.length).toBeGreaterThan(0);
    for (const b of beams) expect(Math.abs(Math.atan2(Math.sin(Math.atan2(b.vy, b.vx) - 1), Math.cos(Math.atan2(b.vy, b.vx) - 1)))).toBeLessThanOrEqual(half + 1e-9);
    const slugs = world.fx.filter((f) => f.type === 'slug');
    expect(slugs.length).toBeGreaterThan(0);
    for (const r of slugs) {
      if (r.type !== 'slug') continue;
      const a = Math.atan2(r.y2 - r.y, r.x2 - r.x);
      expect(Math.abs(Math.atan2(Math.sin(a - 1), Math.cos(a - 1)))).toBeLessThanOrEqual(half + 1e-9);
    }
    expect(behind.hp).toBe(behind.maxHp); // nothing went backwards
  });

  /** Runs the ace's status and release systems for `seconds`. */
  function tick(world: World, seconds: number): void {
    const status = new PlayerStatusSystem();
    const release = new ReleaseSystem();
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      status.update(world, 1 / 60);
      release.update(world, 1 / 60);
    }
  }

  it("starts at the data's level, empties when used, lasts its duration, then needs a full gauge again", () => {
    expect(arena(catalog, loadout).player!.releaseCharge).toBe(sr.charge.start);
    const { world, P, commands } = setup();
    expect(P.releaseCharge).toBe(1);
    commands.superRelease();
    expect(P.releaseCharge).toBe(0);
    expect(P.release).not.toBeNull();
    tick(world, duration + 0.25);
    expect(firesAllWeapons(P)).toBe(false);
    expect(P.release).toBeNull();
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(false); // the gauge is not full
    tick(world, 1 / sr.charge.perSecond - 0.25);
    expect(P.releaseCharge).toBeCloseTo(1, 1);
    tick(world, 0.5);
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(true);
  });

  it('charges from the ace kills, close ones more, and not while a release runs', () => {
    const { world, P, commands } = setup();
    const c = sr.charge;
    const hit = aceHit(catalog.weapon('rifle') as { id: string; damageType: string });
    P.releaseCharge = 0;
    world.combat.kill(addSoldier(world, 'trooper', ENEMY, P.x + c.closeRadius + 100, P.y), hit);
    expect(P.releaseCharge).toBeCloseTo(c.perKill);
    world.combat.kill(addSoldier(world, 'trooper', ENEMY, P.x + 50, P.y), hit);
    expect(P.releaseCharge).toBeCloseTo(c.perKill * (1 + c.closeKillMul));
    world.combat.kill(addSoldier(world, 'trooper', ENEMY, P.x + 60, P.y), ARMY_HIT);
    expect(P.releaseCharge).toBeCloseTo(c.perKill * (1 + c.closeKillMul)); // not the ace's kill

    P.releaseCharge = 1;
    commands.superRelease();
    world.combat.kill(addSoldier(world, 'trooper', ENEMY, P.x + 50, P.y), hit);
    expect(P.releaseCharge).toBe(0);
  });

  it('opens with invulnerability, cuts damage taken while it runs, and readies the dash', () => {
    const { world, P, commands } = setup();
    P.dashCd = 2;
    commands.superRelease();
    expect(P.iframes).toBe(sr.openingIframes);
    expect(P.dashCd).toBe(0);
    const hp = P.hp;
    world.combat.damage(P, 10, ARMY_HIT);
    expect(P.hp).toBe(hp); // invulnerable
    P.iframes = 0;
    world.combat.damage(P, 10, ARMY_HIT);
    expect(hp - P.hp).toBeCloseTo(10 * catalog.battle.balance.aceDamageTaken * sr.damageTakenMul);
  });

  it('is on Space, and dash is on Shift', () => {
    const handlers: Record<string, (e: unknown) => void> = {};
    const target = { addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn) } as unknown as Window;
    const sink = {
      inputMode: () => 'playing',
      selectSlot: vi.fn(),
      setAimIndex: vi.fn(),
      cycleAim: vi.fn(),
      dash: vi.fn(),
      superRelease: vi.fn(),
      reload: vi.fn(),
      zoomBy: vi.fn(),
      togglePause: vi.fn(),
      confirm: vi.fn(),
      back: vi.fn(),
    } satisfies CommandSink;
    new KeyboardInput(sink, () => new KeyMap(defaultKeys(4), []), target);
    const press = (key: string) => handlers.keydown!({ key, repeat: false, preventDefault: () => {} });
    press(' ');
    expect(sink.superRelease).toHaveBeenCalledTimes(1);
    expect(sink.dash).not.toHaveBeenCalled();
    press('Shift');
    expect(sink.dash).toHaveBeenCalledTimes(1);
    expect(sink.superRelease).toHaveBeenCalledTimes(1);
  });
});
