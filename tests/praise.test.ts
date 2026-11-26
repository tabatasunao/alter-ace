import { describe, expect, it } from 'vitest';
import { medalFor, nextMedal, recordSortie, sanitizeCareer } from '../src/game/career';
import { PraiseSystem } from '../src/sim/systems/PraiseSystem';
import { arena, loadTestCatalog } from './helpers';

describe('praise and career', () => {
  const catalog = loadTestCatalog();
  const pr = catalog.battle.praise;
  const medals = catalog.loadout.medals;

  it('praises every kill milestone and a streak of kills, as minor banners', () => {
    const world = arena(catalog);
    const banners: string[] = [];
    world.events.on('banner', ({ text, minor }) => banners.push(`${minor ? 'minor ' : ''}${text}`));
    const praise = new PraiseSystem();
    praise.update(world);
    world.stats.kills = pr.killMilestone;
    world.t = pr.streak.window * 10; // long after the start, so the jump is not a streak
    praise.update(world);
    expect(banners).toEqual([`minor ${pr.killMilestone} kills`]);

    banners.length = 0;
    const praise2 = new PraiseSystem();
    world.stats.kills = 1;
    world.t = 0;
    praise2.update(world);
    world.t = pr.streak.window / 2;
    world.stats.kills = 1 + pr.streak.kills;
    praise2.update(world);
    expect(banners).toContain(`minor ${pr.streak.kills} down in ${pr.streak.window} s`);
    world.t += 0.5;
    world.stats.kills += pr.streak.kills;
    praise2.update(world);
    expect(banners.filter((b) => b.includes('down in'))).toHaveLength(1); // quiet for the cooldown
  });

  it('keeps only clean numbers from storage', () => {
    expect(sanitizeCareer(null)).toEqual({ best: {}, kills: {} });
    expect(sanitizeCareer({ best: { 450: 4000, x: 'no', y: -1 }, kills: { rifle: 12, bad: NaN } })).toEqual({ best: { 450: 4000 }, kills: { rifle: 12 } });
  });

  it('finds the medal reached and the next one', () => {
    expect(medalFor(0, medals)).toBeNull();
    expect(medalFor(medals[0]!.kills, medals)).toBe(medals[0]);
    expect(nextMedal(0, medals)).toBe(medals[0]);
    expect(nextMedal(medals.at(-1)!.kills, medals)).toBeNull();
  });

  it('adds weapon kills, reports each weapon’s new medal, and keeps the best score per army size', () => {
    const start = { best: { 450: 4000 }, kills: { rifle: medals[0]!.kills - 1 } };
    const first = recordSortie(start, { enemies: 450, killsBy: { rifle: medals[1]!.kills, mortar: 3 }, score: 3500 }, medals);
    expect(first.career.kills).toEqual({ rifle: medals[0]!.kills - 1 + medals[1]!.kills, mortar: 3 });
    expect(first.medals).toEqual([{ weapon: 'rifle', medal: medals[1] }]); // its highest new medal only
    expect(first.newBest).toBe(false);
    expect(first.career.best).toEqual({ 450: 4000 });
    expect(start.kills.rifle).toBe(medals[0]!.kills - 1); // the old career is untouched

    const better = recordSortie(first.career, { enemies: 450, killsBy: {}, score: 4500 }, medals);
    expect(better).toMatchObject({ newBest: true, previousBest: 4000 });
    expect(better.career.best[450]).toBe(4500);
    const lost = recordSortie(better.career, { enemies: 600, killsBy: {}, score: null }, medals);
    expect(lost).toMatchObject({ newBest: false, previousBest: null });
    expect(lost.career.best).toEqual({ 450: 4500 });
  });
});
