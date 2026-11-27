import { describe, expect, it } from 'vitest';
import { nextRank, rankLetter, rateSortie } from '../src/game/rating';
import { defeatTip } from '../src/game/tips';
import { describeWeapon } from '../src/ui/HangarView';
import { slotLabel, unitTraitLines } from '../src/ui/damageText';
import { arena, battle, loadFixtureCatalog, loadTestCatalog } from './helpers';
import { tm } from '../src/i18n';
import { unitShape } from '../src/render/painters/unitPainters';
import { ALLY, ENEMY } from '../src/sim/entities';
import { addSoldier } from './helpers';

describe('UI text and rules', () => {
  const catalog = loadTestCatalog();

  it('gives every arsenal card a stat line in its behavior\'s format', () => {
    for (const a of catalog.weapons) expect(describeWeapon(a), a.id).not.toMatch(/undefined|NaN/);
    expect(describeWeapon(catalog.weapon('missile'))).toMatch(/^DMG \d+×\d+ · Range/);
    expect(describeWeapon(catalog.weapon('shotgun'))).toMatch(/^DMG \d+×\d+ · Range/);
    expect(describeWeapon(catalog.weapon('bazooka'))).toMatch(/^DMG \d+ · Blast \d+ · Range/);
    expect(describeWeapon(catalog.weapon('sniper'))).toMatch(/^DMG \d+ · Range 1000/);
    expect(describeWeapon(loadFixtureCatalog().weapon('mortar'))).toMatch(/^Blast \d+ · Range/);
  });

  it('labels hardpoints by damage type', () => {
    expect(slotLabel(catalog, catalog.weapon('sniper'))).toBe('Beam');
    expect(slotLabel(catalog, catalog.weapon('bazooka'))).toBe('Blast');
  });

  it('draws enemy Commanders with their enemy look, allied ones with the class look', () => {
    const world = arena(catalog);
    expect(unitShape(addSoldier(world, 'commander', ENEMY, 0, 0))).toBe('pentagon');
    expect(unitShape(addSoldier(world, 'commander', ALLY, 0, 0))).toBe(catalog.unitClass('commander').shape);
    expect(unitShape(addSoldier(world, 'trooper', ENEMY, 0, 0))).toBe(catalog.unitClass('trooper').shape);
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

  it('names the next rank above a score, and none at the top', () => {
    const ranks = catalog.battle.rating.ranks;
    const top = ranks.reduce((a, b) => (b.minScore > a.minScore ? b : a));
    const bottom = ranks.reduce((a, b) => (b.minScore < a.minScore ? b : a));
    expect(nextRank(top.minScore, ranks)).toBeNull();
    const next = nextRank(bottom.minScore, ranks)!;
    expect(next.minScore).toBeGreaterThan(bottom.minScore);
    expect(ranks.every((r) => r.minScore <= bottom.minScore || r.minScore >= next.minScore)).toBe(true);
  });

  it('gives a lost sortie one tip: an unused Full Arms first, then the dash, then matchups', () => {
    const world = arena(catalog);
    const key = (a: string) => `<${a}>`;
    world.player!.releaseCharge = 1;
    expect(tm(defeatTip({ world, key }))).toMatch(/^Full Arms was ready.*<release>/);
    world.player!.releaseCharge = 0.5;
    expect(tm(defeatTip({ world, key }))).toMatch(/^Dash \(<dash>\)/);
    world.stats.dodges = 1;
    expect(tm(defeatTip({ world, key }))).toMatch(/armor/);
  });
});
