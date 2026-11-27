import type { Point } from '../../core/math';
import type { System } from '../System';
import type { World } from '../World';

abstract class SmoothCamera implements System {
  readonly duringFreeze = true;
  protected abstract target(world: World): Point;
  protected abstract followRate(world: World): number;
  /** Multiplies the zoom the player chose (1 by default). */
  protected zoomScale(_world: World, _dt: number): number {
    return 1;
  }

  update(world: World, dt: number): void {
    const c = world.camera;
    const t = this.target(world);
    const k = Math.min(1, dt * this.followRate(world));
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    const { minZoom, zoomRate } = world.catalog.battle.camera;
    const goal = Math.max(minZoom, c.zoomTarget * this.zoomScale(world, dt));
    c.zoom += (goal - c.zoom) * Math.min(1, dt * zoomRate);
  }
}

/**
 * Battle camera: follows the ace; widens the view while the active weapon asks (`viewZoom`), and
 * closes in while the ace lunges with a weapon that asks (`swingZoom`), holding briefly after.
 */
export class FollowCameraSystem extends SmoothCamera {
  private swing = 0;

  protected target(world: World): Point {
    return world.player ?? world.camera;
  }

  protected override zoomScale(world: World, dt: number): number {
    const P = world.player;
    if (!P?.alive) return 1;
    const def = P.slots[P.active]?.def;
    this.swing = P.lunge ? world.catalog.battle.camera.swingHold : Math.max(0, this.swing - dt);
    const swing = this.swing > 0 ? (def?.swingZoom ?? 1) : 1;
    return (def?.viewZoom || 1) * swing;
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
