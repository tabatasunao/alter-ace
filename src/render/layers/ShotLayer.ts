import type { Projectile } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { SHOT_LOOKS, type ShotPass } from '../painters/shotPainters';

/** Longest streak behind a shot, plus a mortar shell's height above its ground point. */
const CULL_MARGIN = 200;
/** While Full Arms runs, the ace's shots sit on a glow in the Full Arms color: its opacity and width. */
const FULL_ARMS_GLOW = { alpha: 0.4, width: 7 };

/**
 * Projectiles inside the view, each drawn with its look's passes. Most shots in a battle are
 * off-screen, so skipping them is the main saving. Shots are drawn one by one; the canvas
 * batches draw calls itself. While Full Arms runs, the ace's shots are drawn white over a glow
 * in the Full Arms color (one stroke for all of them), so they read apart from ordinary fire.
 */
export class ShotLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const x0 = view.x0 - CULL_MARGIN;
    const x1 = view.x1 + CULL_MARGIN;
    const y0 = view.y0 - CULL_MARGIN;
    const y1 = view.y1 + CULL_MARGIN;
    const inView = (p: Projectile) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    const fullArms = !!world.player?.release;
    ctx.lineCap = 'round';
    if (fullArms) {
      ctx.beginPath();
      for (const p of world.shots) {
        if (p.src !== 'player' || !inView(p)) continue;
        for (const pass of SHOT_LOOKS[p.kind] as readonly ShotPass<Projectile>[]) if (!pass.hideInFullArms) pass.trace(ctx, p);
      }
      ctx.globalAlpha = FULL_ARMS_GLOW.alpha;
      ctx.strokeStyle = palette.release;
      ctx.lineWidth = FULL_ARMS_GLOW.width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of world.shots) {
      if (!inView(p)) continue;
      const white = fullArms && p.src === 'player';
      for (const pass of SHOT_LOOKS[p.kind] as readonly ShotPass<Projectile>[]) {
        if (white && pass.hideInFullArms) continue;
        ctx.beginPath();
        pass.trace(ctx, p);
        const color = white ? palette.ace : pass.color(p, palette);
        if (pass.mode === 'stroke') {
          ctx.strokeStyle = color;
          ctx.lineWidth = pass.width ? pass.width(p) : 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }
    ctx.lineCap = 'butt';
  }
}
