import type { MoveInput } from '../input';
import { movementModelFor } from '../movement/registry';
import { statMul } from '../statuses';
import { activePlayer, type System } from '../System';
import type { World } from '../World';

/**
 * Moves the ace: a dash or saber lunge if one is running, otherwise the configured
 * movement model (battle.json → player.movement) turns input into velocity.
 */
export class PlayerMovementSystem implements System {
  constructor(private readonly input: MoveInput) {}

  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;
    const cfg = world.catalog.battle.player;
    const model = movementModelFor(cfg.movement);
    const topSpeed = P.frame.speed * statMul(P, 'speed');

    const raw = this.input.read();
    let ix = raw.x;
    let iy = raw.y;
    const m = Math.hypot(ix, iy);
    if (m > 1) {
      ix /= m;
      iy /= m;
    }
    P.input = { x: ix, y: iy };

    if (P.dash) {
      const dash = P.dash;
      dash.remaining -= dt;
      P.x += dash.vx * dt;
      P.y += dash.vy * dt;
      world.addFx({ type: 'ghost', x: P.x, y: P.y, t: 0, life: 0.22 });
      if (dash.remaining <= 0) {
        P.dash = null;
        model.afterDash?.({ player: P, dashVx: dash.vx, dashVy: dash.vy, topSpeed, config: cfg.movement });
      }
    } else if (P.lunge) {
      const lunge = P.lunge;
      lunge.remaining -= dt;
      P.x += lunge.vx * dt;
      P.y += lunge.vy * dt;
      world.addFx({ type: 'ghost', x: P.x, y: P.y, t: 0, life: 0.16 });
      if (lunge.remaining <= 0) {
        P.lunge = null;
        lunge.onArrive();
      }
    } else {
      model.steer({ player: P, input: P.input, topSpeed, dt, config: cfg.movement });
      P.x += P.vx * dt;
      P.y += P.vy * dt;
    }

    // Walls: stop at the edge and lose the velocity going into it.
    const min = cfg.edgeMargin;
    const maxX = world.width - cfg.edgeMargin;
    const maxY = world.height - cfg.edgeMargin;
    if (P.x < min) {
      P.x = min;
      if (P.vx < 0) P.vx = 0;
    } else if (P.x > maxX) {
      P.x = maxX;
      if (P.vx > 0) P.vx = 0;
    }
    if (P.y < min) {
      P.y = min;
      if (P.vy < 0) P.vy = 0;
    } else if (P.y > maxY) {
      P.y = maxY;
      if (P.vy > 0) P.vy = 0;
    }
  }
}
