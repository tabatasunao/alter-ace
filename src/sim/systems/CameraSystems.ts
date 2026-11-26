import type { Point } from '../../core/math';
import type { System } from '../System';
import type { World } from '../World';

abstract class SmoothCamera implements System {
  readonly duringFreeze = true;
  protected abstract target(world: World): Point;
  protected abstract followRate(world: World): number;

  update(world: World, dt: number): void {
    const c = world.camera;
    const t = this.target(world);
    const k = Math.min(1, dt * this.followRate(world));
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    c.zoom += (c.zoomTarget - c.zoom) * Math.min(1, dt * world.catalog.battle.camera.zoomRate);
  }
}

/** Battle camera: follows the ace. */
export class FollowCameraSystem extends SmoothCamera {
  protected target(world: World): Point {
    return world.player ?? world.camera;
  }

  protected followRate(world: World): number {
    return world.catalog.battle.camera.followRate;
  }
}

/** Hangar camera: drifts toward the middle of the two armies. */
export class DemoCameraSystem extends SmoothCamera {
  protected target(world: World): Point {
    const [a, b] = world.centroids;
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return a ?? b ?? { x: world.width / 2, y: world.height / 2 };
  }

  protected followRate(world: World): number {
    return world.catalog.battle.camera.demoFollowRate;
  }
}
