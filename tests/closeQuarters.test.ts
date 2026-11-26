import { describe, expect, it } from 'vitest';
import { closeFireRate, closeLead, closeness, closeSpread } from '../src/sim/ai/aim';
import { ALLY, ENEMY } from '../src/sim/entities';
import { SoldierAISystem } from '../src/sim/systems/SoldierAISystem';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('close-quarters fire at the ace', () => {
  const catalog = loadTestCatalog();
  const c = catalog.battle.ai.closeAim;

  it('counts only the ace as a close-quarters target, fully at point blank and not at all from its range out', () => {
    const world = arena(catalog);
    const P = world.player!;
    const ally = addSoldier(world, 'trooper', ALLY, P.x, P.y + 50);
    expect(closeness(P, 0, c)).toBe(1);
    expect(closeness(P, c.range / 2, c)).toBeCloseTo(0.5);
    expect(closeness(P, c.range, c)).toBe(0);
    expect(closeness(ally, 0, c)).toBe(0);
    expect(closeness(P, 0, { ...c, range: 0 })).toBe(0);
  });

  it('raises lead (never below the weapon’s own), tightens spread and speeds up fire with closeness', () => {
    expect(closeLead(0.2, 0, c)).toBe(0.2);
    expect(closeLead(0.2, 1, c)).toBe(Math.max(0.2, c.lead));
    expect(closeLead(0.2, 0.5, c)).toBeCloseTo(0.2 + (c.lead - 0.2) / 2);
    expect(closeLead(1, 1, { ...c, lead: 0.5 })).toBe(1);
    expect(closeSpread(0.1, 1, c)).toBeCloseTo(0.1 * c.spread);
    expect(closeSpread(0.1, 0, c)).toBe(0.1);
    expect(closeFireRate(1, c)).toBe(c.fireRate);
    expect(closeFireRate(0, c)).toBe(1);
  });

  it('an enemy close to the ace fires again sooner than one shooting at an ally from the same distance', () => {
    const world = arena(catalog);
    const P = world.player!;
    const d = c.range / 4;
    const atAce = addSoldier(world, 'trooper', ENEMY, P.x + d, P.y);
    const ally = addSoldier(world, 'trooper', ALLY, P.x - 2000, P.y + 600);
    const atAlly = addSoldier(world, 'trooper', ENEMY, ally.x + d, ally.y);
    for (const u of [atAce, atAlly]) {
      u.cd = 0;
      u.retarget = 99;
    }
    atAce.target = P;
    atAlly.target = ally;
    new SoldierAISystem().update(world, 1 / 60);
    const w = atAce.weapon;
    const jitter = catalog.battle.ai.fireIntervalJitter;
    expect(atAlly.cd).toBeGreaterThanOrEqual(w.interval * (1 - jitter) - 1e-9);
    expect(atAce.cd).toBeLessThanOrEqual((w.interval * (1 + jitter)) / closeFireRate(1 - d / c.range, c) + 1e-9);
    expect(atAce.cd).toBeLessThan(atAlly.cd);
  });
});
