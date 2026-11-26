import { unitTone } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { withAlpha } from '../palette';

/**
 * Aim lines of units busy aiming (a charging lance), kept clearly weaker than the beam itself.
 * While the aim tracks: a faint thin line and a fainter band for the hit width. Once it locks (the
 * cue to dash): a brighter dashed line whose dashes run toward the target. Lines aimed at the ace
 * are drawn stronger.
 */
export class SightLineLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const z = view.zoom;
    const march = world.impact.clock * 90;
    for (const u of world.units) {
      const line = u.kind === 'soldier' ? u.action?.sightLine : null;
      if (!line) continue;
      const atAce = line.target.kind === 'player';
      const alpha = line.locked ? (atAce ? 0.7 : 0.35) : atAce ? 0.22 : 0.08;
      const color = palette.tone(unitTone(u));
      const x2 = u.x + Math.cos(line.angle) * line.range;
      const y2 = u.y + Math.sin(line.angle) * line.range;
      ctx.strokeStyle = withAlpha(color, alpha * 0.12);
      ctx.lineWidth = line.width * 2;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.lineWidth = (line.locked ? 1.5 : 1) / z;
      ctx.setLineDash(line.locked ? [8 / z, 8 / z] : [3 / z, 7 / z]);
      ctx.lineDashOffset = line.locked ? -march / z : 0;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
}
