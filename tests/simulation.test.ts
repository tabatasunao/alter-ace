import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/random';
import { ENEMY } from '../src/sim/entities';
import { NO_INPUT } from '../src/sim/input';
import { battlePipeline, demoPipeline } from '../src/sim/pipelines';
import { createDemoWorld } from '../src/sim/scenarios';
import { ReinforcementSystem } from '../src/sim/systems/ReinforcementSystem';
import { VictorySystem } from '../src/sim/systems/VictorySystem';
import { arena, battle, loadTestCatalog, run, VIEWPORT } from './helpers';
import { tm } from '../src/i18n';

describe('battle simulation (headless)', () => {
  const catalog = loadTestCatalog();

  it('deploys the ace, 100 allies and the first enemy wave', () => {
    const world = battle(catalog);
    const initial = catalog.armies.battle.enemies.initial;
    expect(world.units.filter((u) => u.kind === 'soldier' && u.team === ENEMY)).toHaveLength(initial);
    expect(world.stats.enemyQueue).toHaveLength(world.stats.enemyTotal - initial);
    expect(world.stats.allyAlive).toBe(100);
    expect(world.player?.alive).toBe(true);
  });

  it('replays identically from the same seed and differs with another', () => {
    const snapshot = (seed: number) => {
      const world = battle(catalog, seed);
      run(world, battlePipeline(NO_INPUT), 15);
      return {
        units: world.units.length,
        shots: world.shots.length,
        hp: world.units.slice(0, 40).map((u) => Math.round(u.hp * 1000)),
        xs: world.units.slice(0, 40).map((u) => Math.round(u.x * 1000)),
        stats: { ...world.stats, enemyQueue: world.stats.enemyQueue.length },
      };
    };
    const a = snapshot(7);
    expect(snapshot(7)).toEqual(a);
    expect(snapshot(8)).not.toEqual(a);
  });

  it('the armies close and trade fire', () => {
    const world = battle(catalog, 3);
    run(world, battlePipeline(NO_INPUT), 30);
    const damaged = world.units.filter((u) => u.kind === 'soldier' && u.hp < u.maxHp).length;
    expect(damaged).toBeGreaterThan(0);
  });

  it('brings in reinforcements when the field thins out', () => {
    const world = arena(catalog);
    world.stats.enemyQueue = Array.from({ length: 100 }, () => 'trooper');
    const banners: string[] = [];
    world.events.on('banner', ({ msg }) => banners.push(tm(msg)));
    new ReinforcementSystem().update(world, 1 / 60);
    const battalion = catalog.armies.reinforcements.battalion;
    expect(world.stats.enemyField).toBe(battalion);
    expect(world.stats.enemyQueue).toHaveLength(100 - battalion);
    expect(world.units.filter((u) => u.team === ENEMY).every((u) => u.x > world.width - 400)).toBe(true);
    expect(banners[0]).toMatch(/reinforcements/);
  });

  it('wins once the field and the reserve are empty', () => {
    const world = arena(catalog);
    const ended: boolean[] = [];
    world.events.on('battleEnded', ({ win }) => ended.push(win));
    new VictorySystem().update(world);
    expect(world.status).toMatchObject({ over: true, win: true });
    expect(ended).toEqual([true]);
  });

  it('the hangar skirmish runs without an ace', () => {
    const world = createDemoWorld(catalog, new SeededRandom(1), VIEWPORT);
    expect(world.player).toBeNull();
    expect(() => run(world, demoPipeline(), 20)).not.toThrow();
  });
});
