import { TAU } from '../../core/math';
import type { Player } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';

const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** The ace: weapon range ring, reticle on the current target, and the frame itself. */
export class PlayerLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const P = world.player;
    if (!P || !P.alive) return;
    const z = view.zoom;
    const over = world.status.over;

    const slot = P.slots[P.active];
    if (slot && slot.kind === 'weapon' && !over) {
      ctx.strokeStyle = palette.ring;
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([6 / z, 6 / z]);
      ctx.beginPath();
      ctx.arc(P.x, P.y, slot.def.range, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const t = P.reticle;
    if (t && t.alive && !over) {
      ctx.strokeStyle = palette.aimLine;
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      const r = t.size * 0.5 + 7;
      const L = 6;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [sx, sy] of CORNERS) {
        const cx = t.x + sx * r;
        const cy = t.y + sy * r;
        ctx.moveTo(cx - sx * L, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - sy * L);
      }
      ctx.stroke();
    }

    this.drawThrust(ctx, P, palette.accent, world.t, over);

    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(P.facing);
    if (P.iframes > 0) ctx.globalAlpha = 0.6;
    if (P.statuses.some((s) => s.ring)) {
      ctx.strokeStyle = palette.tool;
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -15, 30, 30);
    }
    ctx.fillStyle = P.flash > 0 ? palette.danger : palette.ace;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(8, -3, 9, 6);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-11.5, -11.5, 23, 23);
    ctx.restore();
  }

  /** Exhaust flame opposite the thrust input, so thrust and drift read separately. */
  private drawThrust(ctx: CanvasRenderingContext2D, P: Player, color: string, time: number, over: boolean): void {
    const thrust = Math.hypot(P.input.x, P.input.y);
    if (thrust < 0.1 || P.dash || P.lunge || over) return;
    const nx = P.input.x / thrust;
    const ny = P.input.y / thrust;
    const length = 8 + 8 * thrust + 3 * Math.sin(time * 50);
    const bx = P.x - nx * 11;
    const by = P.y - ny * 11;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx - ny * 5, by + nx * 5);
    ctx.lineTo(bx - nx * length, by - ny * length);
    ctx.lineTo(bx + ny * 5, by - nx * 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
