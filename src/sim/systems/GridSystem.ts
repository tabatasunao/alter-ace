import type { System } from '../System';
import type { World } from '../World';

/** Re-buckets all units into the spatial grid. Runs first: everything after queries it. */
export class GridSystem implements System {
  update(world: World): void {
    world.grid.rebuild(world.units);
  }
}
