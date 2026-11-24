import type { System } from '../System';
import type { World } from '../World';

const DEBRIS_DRAG = 0.94;

/** Ages visual effects, drifts debris, and drops expired effects. */
export class EffectSystem implements System {
  update(world: World, dt: number): void {
    const fx = world.fx;
    let kept = 0;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i]!;
      f.t += dt;
      if (f.type === 'debris') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= DEBRIS_DRAG;
        f.vy *= DEBRIS_DRAG;
      }
      if (f.t < f.life) fx[kept++] = f;
    }
    fx.length = kept;
  }
}
