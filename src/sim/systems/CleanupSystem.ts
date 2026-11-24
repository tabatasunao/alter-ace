import type { System } from '../System';
import type { World } from '../World';

/** Drops dead units at the end of the step (ids of survivors are unchanged). */
export class CleanupSystem implements System {
  update(world: World): void {
    const units = world.units;
    let kept = 0;
    for (let i = 0; i < units.length; i++) if (units[i]!.alive) units[kept++] = units[i]!;
    units.length = kept;
    if (world.decoys.length) world.decoys = world.decoys.filter((d) => d.alive);
  }
}
