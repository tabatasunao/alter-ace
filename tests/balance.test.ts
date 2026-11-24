import { describe, expect, it } from 'vitest';
import { benchCatalog, runBench } from './balance/weaponBench';

/**
 * Weapon balance band: each weapon alone against 40 enemies from the enemy mix (one seed).
 * Damage output must stay within 0.7×–1.5× of the median weapon.
 */
describe('weapon balance', () => {
  const catalog = benchCatalog();
  const results = catalog.weapons.map((w) => runBench(catalog, { weapon: w.id, enemies: 40, seed: 1 }));
  const sorted = results.map((r) => r.hpPerSecond).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;

  it.each(results.map((r) => [r.weapon, r] as const))('%s is within 0.7x to 1.5x of the median weapon', (_id, r) => {
    expect(r.hpPerSecond).toBeGreaterThan(median * 0.7);
    expect(r.hpPerSecond).toBeLessThan(median * 1.5);
  });

  const saber = results.find((r) => r.weapon === 'saber')!;
  const ranged = results.filter((r) => r.weapon !== 'saber');

  it('the melee weapon draws at least 1.75x the incoming fire of any ranged weapon', () => {
    expect(saber.incomingPerMin).toBeGreaterThan(Math.max(...ranged.map((r) => r.incomingPerMin)) * 1.75);
  });

  it.each(ranged.map((r) => [r.weapon, r] as const))('kiting with %s still draws enemy fire', (_id, r) => {
    expect(r.incomingPerMin).toBeGreaterThan(0);
  });

  it('the median ranged weapon draws more than 150 incoming damage per minute while kiting', () => {
    const incoming = ranged.map((r) => r.incomingPerMin).sort((a, b) => a - b);
    expect(incoming[Math.floor(incoming.length / 2)]).toBeGreaterThan(150);
  });
});
