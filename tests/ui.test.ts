import { describe, expect, it } from 'vitest';
import { rankLetter, rateSortie } from '../src/game/rating';
import { describeArmament } from '../src/ui/HangarView';
import { slotLabel, unitTraitLines } from '../src/ui/damageText';
import { battle, loadTestCatalog } from './helpers';

describe('UI text and rules', () => {
  const catalog = loadTestCatalog();

  it('gives every arsenal card a stat line in its behavior\'s format', () => {
    for (const a of catalog.armaments) expect(describeArmament(a), a.id).not.toMatch(/undefined|NaN/);
    expect(describeArmament(catalog.armament('missile'))).toMatch(/^DMG \d+×\d+ · Range/);
    expect(describeArmament(catalog.armament('breach'))).toMatch(/^DMG \d+×\d+ · Blast \d+ · Range/);
    expect(describeArmament(catalog.armament('gatling'))).toMatch(/Heat \d+ shots · Overheat/);
    expect(describeArmament(catalog.armament('mortar'))).toMatch(/^Blast \d+ · Range/);
    expect(describeArmament(catalog.armament('repair'))).toMatch(/^Recharge \d+ s$/);
  });

  it('labels hardpoints by damage type, or Tool', () => {
    expect(slotLabel(catalog, catalog.armament('beamRifle'))).toBe('Beam');
    expect(slotLabel(catalog, catalog.armament('emp'))).toBe('Tool');
  });

  it('lists special traits in the legend', () => {
    expect(unitTraitLines(catalog.unitClass('marksman'))).toEqual([expect.stringMatching(/^Shield/)]);
    expect(unitTraitLines(catalog.unitClass('trooper'))).toEqual([expect.stringMatching(/1\.5× damage from aces/)]);
    expect(unitTraitLines(catalog.unitClass('bulwark'))).toEqual([]);
  });

  it('rates a won sortie by pace, damage taken and the allied line; a lost one has no rating', () => {
    const r = catalog.battle.rating;
    expect(rankLetter(1e9, r.ranks)).toBe(r.ranks[0]!.letter);
    expect(rankLetter(0, r.ranks)).toBe(r.ranks[r.ranks.length - 1]!.letter);

    const world = battle(catalog);
    expect(rateSortie(world)).toBeNull(); // still running
    const s = world.stats;
    Object.assign(world.status, { over: true, win: true, endAt: r.parSecondsPerEnemy * s.enemyTotal });
    s.dmgTaken = 0;
    s.allyAlive = s.allyTotal;
    const best = rateSortie(world)!;
    expect(best.pace).toBe(1);
    expect(best.integrity).toBe(1);
    expect(best.line).toBeCloseTo(1 + r.lineBonus);
    expect(best.score).toBe(Math.round(r.pointsPerEnemy * (1 + r.lineBonus) * s.enemyTotal));
    expect(best.letter).toBe(rankLetter(best.perEnemy, r.ranks));

    world.status.endAt *= 1 / r.paceMin + 1; // slower than the pace floor
    s.dmgTaken = world.player!.maxHp * 100;
    s.allyAlive = 0;
    const worst = rateSortie(world)!;
    expect(worst.pace).toBe(r.paceMin);
    expect(worst.integrity).toBe(r.integrityMin);
    expect(worst.line).toBe(1);
    expect(worst.score).toBeLessThan(best.score);

    world.status.win = false;
    expect(rateSortie(world)).toBeNull();
    expect(world.enemiesLeft).toBe(s.enemyField + s.enemyQueue.length);
  });
});
