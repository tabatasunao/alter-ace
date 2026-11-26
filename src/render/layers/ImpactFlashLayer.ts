import type { ScreenFrame, ScreenLayer } from '../layers';
import { withAlpha } from '../palette';

/** Peak opacity of a full-strength flash. */
const MAX_ALPHA = 0.32;
/** Peak opacity of the red screen edges when the ace is hurt. */
const HURT_ALPHA = 0.55;

/**
 * The screen flash of a big moment: a light frame, then a dark one, so the flash keeps its
 * contrast instead of washing the screen out. Weaker when the camera is close or the viewer asked
 * for reduced motion; tinted with the danger color for hits on the ace. When the ace is hurt the
 * screen edges redden and fade back.
 */
export class ImpactFlashLayer implements ScreenLayer {
  draw({ ctx, world, palette, view, width, height, motion }: ScreenFrame): void {
    const s = world.impact;
    if (s.hurt > 0) {
      const r = Math.hypot(width, height) / 2;
      const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r);
      g.addColorStop(0, withAlpha(palette.danger, 0));
      g.addColorStop(1, withAlpha(palette.danger, HURT_ALPHA * s.hurt * Math.max(0.5, motion)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    if (s.flash <= 0 || s.flashPeak <= 0) return;
    const light = s.flash / s.flashPeak > 0.5;
    ctx.globalAlpha = s.flash * MAX_ALPHA * motion * Math.min(1, 1 / view.zoom);
    ctx.fillStyle = light ? (s.flashDanger ? palette.danger : palette.ace) : palette.field;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
