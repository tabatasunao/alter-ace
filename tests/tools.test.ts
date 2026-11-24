import { describe, expect, it } from 'vitest';
import { chooseTarget } from '../src/sim/ai/targetSelection';
import { ALLY, ENEMY, type ToolSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { statMul } from '../src/sim/statuses';
import { PlayerStatusSystem } from '../src/sim/systems/PlayerStatusSystem';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('tools', () => {
  const catalog = loadTestCatalog();
  const loadout = { slots: ['rifle', 'emp', 'decoy', 'overboost'] };

  it('EMP stuns nearby enemies, clears their shots, and recharges with the frame multiplier', () => {
    const world = arena(catalog, loadout);
    const P = world.player!;
    const near = addSoldier(world, 'trooper', ENEMY, P.x + 150, P.y);
    const far = addSoldier(world, 'trooper', ENEMY, P.x + 600, P.y);
    const shot = (team: 0 | 1) => ({
      kind: 'bullet' as const, x: P.x + 50, y: P.y, vx: 0, vy: 0, team, dmg: 1, life: 1, r: 2, pierce: 0, hits: null,
      splash: 0, splashDmg: 0, homing: null, target: null, maxSpeed: 0, src: 'army' as const, wid: null, dtype: null,
    });
    world.shots.push(shot(ENEMY), shot(ALLY));
    new PlayerCommands(world).selectSlot(1);
    expect(near.stunT).toBeGreaterThan(0);
    expect(far.stunT).toBe(0);
    expect(world.shots.map((s) => s.team)).toEqual([ALLY]);
    const slot = P.slots[1] as ToolSlot;
    expect(slot.cd).toBeCloseTo(slot.def.cooldown * P.frame.toolMul);
  });

  it('refuses a recharging tool and says so', () => {
    const world = arena(catalog, loadout);
    const denied: number[] = [];
    world.events.on('slotDenied', ({ slot }) => denied.push(slot));
    const commands = new PlayerCommands(world);
    commands.selectSlot(1);
    commands.selectSlot(1);
    expect(denied).toEqual([1]);
  });

  it('Decoy Beacon pulls nearby enemies onto it', () => {
    const world = arena(catalog, loadout);
    const P = world.player!;
    const enemy = addSoldier(world, 'trooper', ENEMY, P.x + 300, P.y);
    new PlayerCommands(world).selectSlot(2);
    expect(world.decoys).toHaveLength(1);
    expect(enemy.retarget).toBe(0);
    expect(chooseTarget(world, enemy)).toBe(world.decoys[0]);
  });

  it('Overboost speeds the ace up and wears off', () => {
    const world = arena(catalog, loadout);
    const P = world.player!;
    new PlayerCommands(world).selectSlot(3);
    expect(statMul(P, 'speed')).toBeGreaterThan(1);
    expect(statMul(P, 'fireInterval')).toBeLessThan(1);
    const status = new PlayerStatusSystem();
    for (let i = 0; i < 60 * 5; i++) status.update(world, 1 / 60);
    expect(P.statuses).toEqual([]);
    expect(statMul(P, 'speed')).toBe(1);
  });

  it('using a tool again refreshes its status instead of stacking it', () => {
    const world = arena(catalog, loadout);
    const P = world.player!;
    const commands = new PlayerCommands(world);
    commands.selectSlot(3);
    const once = statMul(P, 'speed');
    new PlayerStatusSystem().update(world, 1);
    (P.slots[3] as ToolSlot).cd = 0;
    commands.selectSlot(3);
    expect(P.statuses).toHaveLength(1);
    expect(statMul(P, 'speed')).toBe(once);
    const overboost = catalog.tools.find((t) => t.effect === 'overboost') as { duration: number };
    expect(P.statuses[0]!.remaining).toBe(overboost.duration);
  });

  it('Repair Nanites restore the configured share of HP', () => {
    const world = arena(catalog, { slots: ['rifle', 'repair', 'emp', 'decoy'] });
    const P = world.player!;
    P.hp = 10;
    world.t = 0;
    P.lastHit = 0; // stay in combat so regeneration doesn't add HP
    new PlayerCommands(world).selectSlot(1);
    const status = new PlayerStatusSystem();
    for (let i = 0; i < 60 * 3; i++) status.update(world, 1 / 60);
    const tool = catalog.tools.find((t) => t.effect === 'repair') as { healFraction: number };
    expect(P.hp).toBeCloseTo(10 + P.maxHp * tool.healFraction, 0);
  });
});
