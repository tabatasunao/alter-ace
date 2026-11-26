import { TAU } from '../../core/math';
import { isSemiAce } from '../../sim/entities';
import type { ScreenFrame, ScreenLayer } from '../layers';

/** Distance of the arrows from the screen edges, in CSS pixels, clear of the HUD's top and bottom bars. */
const INSET_X = 30;
const INSET_TOP = 100;
const INSET_BOTTOM = 130;

/** Badge radius, in CSS pixels. */
const BADGE = 7;

/**
 * Small "!" badges on the screen edge, each with a pointer toward a threat outside the view: a unit
 * charging a lance at the ace (red and blinking once the aim locks) or a stalking enemy semi-ace.
 */
export class ThreatLayer implements ScreenLayer {
  draw({ ctx, world, palette, view, width, height }: ScreenFrame): void {
    const P = world.player;
    if (!P || !P.alive || world.status.over) return;
    const cx = width / 2;
    const cy = height / 2;
    const mx = (view.x0 + view.x1) / 2;
    const my = (view.y0 + view.y1) / 2;
    const blink = ((world.impact.clock * 8) | 0) % 2 === 0;
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.alive || u.team === P.team) continue;
      const line = u.action?.sightLine;
      const aiming = !!line && line.target === P;
      if (!aiming && !(u.stalking && isSemiAce(u))) continue;
      if (u.x >= view.x0 && u.x <= view.x1 && u.y >= view.y0 && u.y <= view.y1) continue;
      const sx = (u.x - mx) * view.zoom;
      const sy = (u.y - my) * view.zoom;
      const hx = sx >= 0 ? width - INSET_X - cx : cx - INSET_X;
      const hy = sy >= 0 ? height - INSET_BOTTOM - cy : cy - INSET_TOP;
      const k = Math.min(hx / Math.max(1e-6, Math.abs(sx)), hy / Math.max(1e-6, Math.abs(sy)));
      const x = cx + sx * k;
      const y = cy + sy * k;
      const locked = aiming && line.locked;
      if (locked && !blink) continue;
      const a = Math.atan2(sy, sx);
      const color = aiming ? (locked ? palette.danger : palette.enemy) : palette.semiAce;
      // Pointer toward the threat.
      const tip = BADGE + 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * tip, y + Math.sin(a) * tip);
      ctx.lineTo(x + Math.cos(a + 0.55) * (BADGE - 1), y + Math.sin(a + 0.55) * (BADGE - 1));
      ctx.lineTo(x + Math.cos(a - 0.55) * (BADGE - 1), y + Math.sin(a - 0.55) * (BADGE - 1));
      ctx.closePath();
      ctx.fill();
      // The badge.
      ctx.strokeStyle = palette.field;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, BADGE, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.field;
      ctx.font = `700 11px ${palette.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y + 0.5);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }
}
