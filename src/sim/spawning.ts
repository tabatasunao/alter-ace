import { clamp } from '../core/math';
import type { Random } from '../core/random';
import type { ArmiesData, ArmyMix } from '../data/types';
import type { Team } from './entities';
import type { World } from './World';

/**
 * Class ids for an army of `n`, by `mix` shares (with minimums); the filler class takes the rest.
 * `exact` fixes the count of some classes instead, in or out of the mix. Shuffled.
 */
export function armyList(n: number, mix: ArmyMix, armies: ArmiesData, random: Random, exact: Readonly<Record<string, number>> = {}): string[] {
  const list: string[] = [];
  let rest = n;
  const add = (id: string, count: number) => {
    for (let i = 0; i < count; i++) list.push(id);
    rest -= count;
  };
  for (const [id, count] of Object.entries(exact)) add(id, count);
  for (const [id, share] of Object.entries(mix)) {
    if (id in exact) continue;
    add(id, Math.max(armies.minimums[id] ?? 0, Math.round(n * share)));
  }
  for (let i = 0; i < rest; i++) list.push(armies.fillerClass);
  return random.shuffle(list);
}

/** The north-south offset of block `i` of `groups`, `spacing` apart and centered. */
export const groupOffset = (i: number, groups: number, spacing: number): number => (i - (groups - 1) / 2) * spacing;

/**
 * Deploys `classIds` as a block centered on (cx, cy). `facing` is +1 (east) or -1 (west);
 * each class sits `formationOffset` ahead of the block's center line. `spacing` defaults to
 * `formation.spacing`.
 */
export function spawnGroup(world: World, classIds: readonly string[], team: Team, cx: number, cy: number, facing: 1 | -1, spacing = world.catalog.armies.formation.spacing): void {
  const { jitter, columnsFactor, edgeMargin } = world.catalog.armies.formation;
  const n = classIds.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * columnsFactor)));
  const rows = Math.ceil(n / cols);
  const r = world.random;
  classIds.forEach((id, i) => {
    const def = world.catalog.unitClass(id);
    const col = i % cols;
    const row = (i / cols) | 0;
    const forward = (col - (cols - 1) / 2) * spacing + def.formationOffset;
    const x = cx + facing * forward + r.range(-jitter, jitter);
    const y = cy + (row - (rows - 1) / 2) * spacing + r.range(-jitter, jitter);
    world.units.push(
      world.factory.soldier(def, team, clamp(x, edgeMargin, world.width - edgeMargin), clamp(y, edgeMargin, world.height - edgeMargin)),
    );
  });
}
