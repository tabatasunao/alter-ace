import { describe, expect, it, vi } from 'vitest';
import type { CommandSink } from '../src/input/commands';
import { keyBindings } from '../src/input/commands';
import { KeyboardInput } from '../src/input/KeyboardInput';
import { ENEMY, type FlyingShot, type ToolSlot, type WeaponSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { firesAllWeapons } from '../src/sim/statuses';
import { PlayerStatusSystem } from '../src/sim/systems/PlayerStatusSystem';
import { PlayerWeaponSystem } from '../src/sim/systems/PlayerWeaponSystem';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('super release', () => {
  const catalog = loadTestCatalog();
  const { duration, cooldown } = catalog.battle.player.superRelease;
  const loadout = { slots: ['rifle', 'missile', 'bazooka', 'repair'] };

  function setup() {
    const world = arena(catalog, loadout);
    const P = world.player!;
    const target = addSoldier(world, 'bulwark', ENEMY, P.x + 200, P.y);
    target.hp = target.maxHp = 1e9;
    return { world, P, commands: new PlayerCommands(world) };
  }
  const ammo = (P: { slots: unknown[] }) => P.slots.map((s) => ((s as WeaponSlot).kind === 'weapon' ? (s as WeaponSlot).ammo : 'tool'));

  it('fires only the active weapon normally', () => {
    const { world, P } = setup();
    const before = ammo(P);
    new PlayerWeaponSystem().update(world, 1 / 60);
    const after = ammo(P);
    expect(after[0]).toBeLessThan(before[0] as number);
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it('fires every weapon hardpoint at once while it runs, but not tools', () => {
    const { world, P, commands } = setup();
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(true);
    const before = ammo(P);
    new PlayerWeaponSystem().update(world, 1 / 60);
    const after = ammo(P);
    for (const i of [0, 1, 2]) expect(after[i], `slot ${i}`).toBeLessThan(before[i] as number);
    expect((P.slots[3] as ToolSlot).cd).toBe(0); // the repair tool was not used
    expect(P.statuses).toHaveLength(1);
  });

  it('opens with a fireworks burst from every weapon, even with no enemy around, using no ammo', () => {
    const world = arena(catalog, loadout); // just the ace
    const P = world.player!;
    const before = ammo(P);
    new PlayerCommands(world).superRelease();
    const { openingBurst } = catalog.battle.player.superRelease;
    const expected = (id: string, perShot = 1) => {
      const w = catalog.armament(id) as { interval: number };
      return Math.max(1, Math.round((openingBurst * perShot) / (w.interval * P.frame.rateMul)));
    };
    const salvo = (catalog.armament('missile') as { salvo: number }).salvo;
    const shots = world.shots as FlyingShot[];
    expect(shots.filter((s) => s.wid === 'rifle')).toHaveLength(expected('rifle'));
    expect(shots.filter((s) => s.wid === 'missile')).toHaveLength(expected('missile', salvo));
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
    const world = arena(catalog, loadout);
    const P = world.player!;
    const enemies = Array.from({ length: 12 }, (_, i) => addSoldier(world, 'trooper', ENEMY, P.x + 200 + (i % 4) * 60, P.y - 120 + Math.floor(i / 4) * 120));
    new PlayerCommands(world).superRelease();
    const missiles = (world.shots as FlyingShot[]).filter((s) => s.kind === 'missile');
    expect(missiles.length).toBeGreaterThan(enemies.length);
    const firstRound = missiles.slice(0, enemies.length).map((m) => m.target);
    expect(new Set(firstRound).size).toBe(enemies.length); // one each before any doubles up
  });

  it('bursts a saber as a full-circle slash, and mortar shells at random spots around the ace', () => {
    const world = arena(catalog, { slots: ['saber', 'mortar', 'rifle', 'repair'] });
    const P = world.player!;
    const behind = addSoldier(world, 'bulwark', ENEMY, P.x - 60, P.y);
    behind.hp = behind.maxHp = 1e6;
    new PlayerCommands(world).superRelease();
    expect(behind.hp).toBeLessThan(behind.maxHp);
    const shells = world.shots.filter((s) => s.kind === 'mortar');
    expect(shells.length).toBeGreaterThan(0);
    const range = (catalog.armament('mortar') as { range: number }).range;
    for (const s of shells) {
      if (s.kind !== 'mortar') continue;
      const d = Math.hypot(s.tx - P.x, s.ty - P.y);
      expect(d).toBeGreaterThanOrEqual(range * 0.3 - 1e-6);
      expect(d).toBeLessThanOrEqual(range * 0.8 + 1e-6);
    }
  });

  it('keeps the Beam Rifle and Railgun bursts in the front arc, where the ace is facing', () => {
    const world = arena(catalog, { slots: ['beamRifle', 'rail', 'rifle', 'repair'] });
    const P = world.player!;
    P.facing = 1; // radians
    const behind = addSoldier(world, 'bulwark', ENEMY, P.x - Math.cos(1) * 300, P.y - Math.sin(1) * 300);
    behind.hp = behind.maxHp = 1e6;
    new PlayerCommands(world).superRelease();
    const half = ((catalog.armament('beamRifle') as { burstArc: number }).burstArc * Math.PI) / 360;
    const beams = (world.shots as FlyingShot[]).filter((s) => s.kind === 'beam');
    expect(beams.length).toBeGreaterThan(0);
    for (const b of beams) expect(Math.abs(Math.atan2(Math.sin(Math.atan2(b.vy, b.vx) - 1), Math.cos(Math.atan2(b.vy, b.vx) - 1)))).toBeLessThanOrEqual(half + 1e-9);
    const rails = world.fx.filter((f) => f.type === 'rail');
    for (const r of rails) {
      if (r.type !== 'rail') continue;
      const a = Math.atan2(r.y2 - r.y, r.x2 - r.x);
      expect(Math.abs(Math.atan2(Math.sin(a - 1), Math.cos(a - 1)))).toBeLessThanOrEqual(half + 1e-9);
    }
    expect(behind.hp).toBe(behind.maxHp); // nothing went backwards
  });

  it('lasts its duration, then recharges for its cooldown', () => {
    const { world, P, commands } = setup();
    const status = new PlayerStatusSystem();
    commands.superRelease();
    expect(P.releaseCd).toBe(cooldown);
    for (let i = 0; i < Math.round((duration + 0.25) * 60); i++) status.update(world, 1 / 60);
    expect(firesAllWeapons(P)).toBe(false);
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(false); // still recharging
    for (let i = 0; i < Math.round((cooldown - duration) * 60); i++) status.update(world, 1 / 60);
    commands.superRelease();
    expect(firesAllWeapons(P)).toBe(true);
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
    } satisfies CommandSink;
    new KeyboardInput(sink, () => keyBindings(4, []), target);
    const press = (key: string) => handlers.keydown!({ key, repeat: false, preventDefault: () => {} });
    press(' ');
    expect(sink.superRelease).toHaveBeenCalledTimes(1);
    expect(sink.dash).not.toHaveBeenCalled();
    press('Shift');
    expect(sink.dash).toHaveBeenCalledTimes(1);
    expect(sink.superRelease).toHaveBeenCalledTimes(1);
  });
});
