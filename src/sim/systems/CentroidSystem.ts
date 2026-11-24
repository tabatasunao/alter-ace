import { ALLY } from '../entities';
import type { System } from '../System';
import type { World } from '../World';

/** Average position of each army (idle units advance on the enemy's). Decoys don't count. */
export class CentroidSystem implements System {
  update(world: World): void {
    let sx0 = 0;
    let sy0 = 0;
    let n0 = 0;
    let sx1 = 0;
    let sy1 = 0;
    let n1 = 0;
    for (const u of world.units) {
      if (u.kind === 'decoy') continue;
      if (u.team === ALLY) {
        sx0 += u.x;
        sy0 += u.y;
        n0++;
      } else {
        sx1 += u.x;
        sy1 += u.y;
        n1++;
      }
    }
    world.centroids = [n0 ? { x: sx0 / n0, y: sy0 / n0 } : null, n1 ? { x: sx1 / n1, y: sy1 / n1 } : null];
  }
}
