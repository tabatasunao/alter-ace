import { motionFor } from '../projectiles/motions';
import type { System } from '../System';
import type { World } from '../World';

/** Advances every projectile with its kind's motion and removes spent ones. */
export class ProjectileSystem implements System {
  update(world: World, dt: number): void {
    const shots = world.shots;
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i]!;
      if (motionFor(p).step(p, dt, world)) {
        shots[i] = shots[shots.length - 1]!;
        shots.pop();
      }
    }
  }
}
