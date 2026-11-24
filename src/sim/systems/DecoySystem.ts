import type { System } from '../System';
import type { World } from '../World';

/** Counts down decoy beacons and pops them when they expire. */
export class DecoySystem implements System {
  update(world: World, dt: number): void {
    for (const d of world.decoys) {
      if (!d.alive) continue;
      d.life -= dt;
      if (d.flash > 0) d.flash -= dt;
      if (d.life <= 0) {
        d.alive = false;
        world.addFx({ type: 'boom', x: d.x, y: d.y, r: 40, t: 0, life: 0.35, tone: 'tool' });
      }
    }
  }
}
