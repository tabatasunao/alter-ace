import { TAU } from '../../core/math';
import { unitTone } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { withAlpha } from '../palette';

/** Things on the ground under the units: aura rings and mortar landing markers. */
export class GroundLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
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
  }
}
