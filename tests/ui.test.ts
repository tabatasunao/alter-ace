import { describe, expect, it } from 'vitest';
import { aceRank, rateSortie } from '../src/game/rating';
import { describeArmament } from '../src/ui/HangarView';
import { slotLabel, unitTraitLines } from '../src/ui/damageText';
import { battle, loadTestCatalog } from './helpers';

describe('UI text and rules', () => {
  const catalog = loadTestCatalog();

  it('gives every arsenal card a stat line in its behavior\'s format', () => {
    for (const a of catalog.armaments) expect(describeArmament(a), a.id).not.toMatch(/undefined|NaN/);
    expect(describeArmament(catalog.armament('missile'))).toMatch(/^DMG \d+×\d+ · Range/);
    expect(describeArmament(catalog.armament('bazooka'))).toMatch(/^DMG \d+\+\d+ · Range/);
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

  it('rates a sortie by the share of the enemy army the ace destroyed', () => {
    const ranks = catalog.battle.ranks;
    expect(aceRank(1, ranks)).toBe(ranks[0]!.letter);
    expect(aceRank(0, ranks)).toBe(ranks[ranks.length - 1]!.letter);
    const world = battle(catalog);
    world.stats.kills = Math.ceil(world.stats.enemyTotal * ranks[0]!.minShare);
    expect(rateSortie(world).letter).toBe(ranks[0]!.letter);
    expect(world.enemiesLeft).toBe(world.stats.enemyField + world.stats.enemyQueue.length);
  });
});
