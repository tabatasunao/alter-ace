import { describe, expect, it } from 'vitest';
import type { DecoyTool, EmpTool, OverboostTool, RepairTool } from '../src/data/types';
import { ENEMY, type ToolSlot } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { statMul } from '../src/sim/statuses';
import { CleanupSystem } from '../src/sim/systems/CleanupSystem';
import { PlayerStatusSystem } from '../src/sim/systems/PlayerStatusSystem';
import { ReleaseSystem } from '../src/sim/systems/ReleaseSystem';
import { releaseTicks } from '../src/sim/tools/ToolEffect';
import type { World } from '../src/sim/World';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('tools during super release', () => {
  const catalog = loadTestCatalog();
  const { duration } = catalog.battle.player.superRelease;
  const tool = <T>(id: string) => catalog.armament(id) as T;

  function releaseWith(slots: string[]): World {
    const world = arena(catalog, { slots });
    new PlayerCommands(world).superRelease();
    return world;
  }

  function runRelease(world: World): void {
    const status = new PlayerStatusSystem();
    const release = new ReleaseSystem();
    for (let i = 0; i < Math.round((duration + 0.1) * 60); i++) {
      status.update(world, 1 / 60);
      release.update(world, 1 / 60);
    }
  }

  it('counts repeats strictly inside the release', () => {
    expect(releaseTicks(0, 3, 1, 3)).toBe(2);
    expect(releaseTicks(0.5, 1.5, 1, 3)).toBe(1);
    expect(releaseTicks(1, 1.01, 1, 3)).toBe(0);
  });

  it('EMP bursts at the start and every interval, without using its recharge', () => {
    const emp = tool<EmpTool>('emp');
    const world = releaseWith(['rifle', 'emp']);
    const P = world.player!;
    const near = addSoldier(world, 'trooper', ENEMY, P.x + 100, P.y);
    runRelease(world);
    expect(world.fx.filter((f) => f.type === 'emp')).toHaveLength(1 + releaseTicks(0, duration, emp.releaseInterval, duration));
    expect(near.stunT).toBeGreaterThan(0);
    expect((P.slots[1] as ToolSlot).cd).toBe(0);
  });

  it('Decoy leaves afterimages with their own HP and life', () => {
    const d = tool<DecoyTool>('decoy');
    const world = releaseWith(['rifle', 'decoy']);
    runRelease(world);
    expect(world.decoys).toHaveLength(1 + releaseTicks(0, duration, d.releaseInterval, duration));
    expect(world.decoys.every((x) => x.maxHp === d.releaseHp)).toBe(true);
  });

  it('Overboost runs for the whole release, keeps a longer boost, and never stacks', () => {
    const o = tool<OverboostTool>('overboost');
    const world = releaseWith(['rifle', 'overboost']);
    const P = world.player!;
    expect(P.statuses.find((s) => s.id === o.id)!.remaining).toBe(duration);
    expect(statMul(P, 'speed')).toBe(o.speedMul);

    const boosted = arena(catalog, { slots: ['rifle', 'overboost'] });
    const commands = new PlayerCommands(boosted);
    commands.selectSlot(1);
    const Q = boosted.player!;
    Q.statuses.find((s) => s.id === o.id)!.remaining = duration + 2;
    commands.superRelease();
    expect(Q.statuses.find((s) => s.id === o.id)!.remaining).toBe(duration + 2);
    expect(statMul(Q, 'speed')).toBe(o.speedMul);
  });

  it('Repair heals its share of max HP over the release, on top of a repair already running', () => {
    const r = tool<RepairTool>('repair');
    const world = arena(catalog, { slots: ['rifle', 'repair'] });
    const P = world.player!;
    const commands = new PlayerCommands(world);
    commands.selectSlot(1);
    commands.superRelease();
    expect(P.statuses.map((s) => s.id)).toEqual(['repair', 'superRelease', 'repair:release']);
    P.hp = 1;
    runRelease(world);
    expect(P.hp).toBeGreaterThanOrEqual(1 + P.maxHp * r.healFraction - 1);
  });

  it('commands between steps see the current units, even after cleanup compacted the list', () => {
    const world = arena(catalog, { slots: ['rifle', 'emp'] });
    const P = world.player!;
    const doomed = Array.from({ length: 20 }, (_, i) => addSoldier(world, 'trooper', ENEMY, P.x + 1500 + i * 20, P.y));
    const near = addSoldier(world, 'trooper', ENEMY, P.x + 100, P.y);
    for (const u of doomed) u.alive = false;
    new CleanupSystem().update(world); // compacts world.units; the grid still holds the old indices
    new PlayerCommands(world).selectSlot(1);
    expect(near.stunT).toBeGreaterThan(0);
  });

  it('a release that downs enough enemies ends with a banner', () => {
    const world = releaseWith(['rifle', 'repair']);
    const banners: string[] = [];
    world.events.on('banner', ({ text, minor }) => banners.push(`${minor ? 'minor ' : ''}${text}`));
    world.stats.kills += catalog.battle.praise.releaseMinKills;
    runRelease(world);
    expect(banners).toEqual([`minor Super release: ${catalog.battle.praise.releaseMinKills} down`]);
  });
});
