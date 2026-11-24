import type { System } from '../System';
import type { World } from '../World';

/** Steps what AI units are busy doing (charges, lunges). A stun, or the unit dying, cancels the action. */
export class UnitActionSystem implements System {
  update(world: World, dt: number): void {
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.action) continue;
      if (!u.alive || u.stunT > 0) {
        u.action = null;
        continue;
      }
      if (u.action.step(dt)) u.action = null;
    }
  }
}
