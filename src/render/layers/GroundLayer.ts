import { TAU } from '../../core/math';
import { unitTone } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { withAlpha } from '../palette';

/** Things on the ground under the units: aura rings, mortar landing markers and the tutorial's ring. */
export class GroundLayer implements WorldLayer {
  draw(frame: WorldFrame): void {
    const { ctx, world, palette, view } = frame;
    const z = view.zoom;
    ctx.lineWidth = 1 / z;
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.def.aura) continue;
      ctx.strokeStyle = palette.aura(unitTone(u));
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.def.aura.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([8 / z, 6 / z]);
    for (const p of world.shots) {
      if (p.kind !== 'mortar') continue;
      const k = p.t / p.flight;
      ctx.strokeStyle = withAlpha(palette.accent, 0.25 + 0.5 * k);
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, p.splash, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this.drawMarker(frame);
  }

  /** The tutorial's ring to fly into: a gold disc with a ring that breathes. */
  private drawMarker({ ctx, world, palette, view }: WorldFrame): void {
    const m = world.tutorial?.marker;
    if (!m) return;
    const pulse = 0.5 + 0.5 * Math.sin(world.t * 4);
    ctx.fillStyle = withAlpha(palette.accent, 0.08 + 0.06 * pulse);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2 / view.zoom;
    ctx.strokeStyle = withAlpha(palette.accent, 0.55 + 0.35 * pulse);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * (1 + 0.06 * pulse), 0, TAU);
    ctx.stroke();
  }
}
