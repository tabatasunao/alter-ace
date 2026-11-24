import type { Projectile } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { SHOT_LOOKS, type ShotPass } from '../painters/shotPainters';

/** Longest streak behind a shot, plus a mortar shell's height above its ground point. */
const CULL_MARGIN = 200;

/**
 * Projectiles inside the view, each drawn with its look's passes. Most shots in a battle are
 * off-screen, so skipping them is the main saving. Shots are drawn one by one; the canvas
 * batches draw calls itself.
 */
export class ShotLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const x0 = view.x0 - CULL_MARGIN;
    const x1 = view.x1 + CULL_MARGIN;
    const y0 = view.y0 - CULL_MARGIN;
    const y1 = view.y1 + CULL_MARGIN;
    ctx.lineCap = 'round';
    for (const p of world.shots) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      for (const pass of SHOT_LOOKS[p.kind] as readonly ShotPass<Projectile>[]) {
        ctx.beginPath();
        pass.trace(ctx, p);
        if (pass.mode === 'stroke') {
          ctx.strokeStyle = pass.color(p, palette);
          ctx.lineWidth = pass.width ? pass.width(p) : 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = pass.color(p, palette);
          ctx.fill();
        }
      }
    }
    ctx.lineCap = 'butt';
  }
}
