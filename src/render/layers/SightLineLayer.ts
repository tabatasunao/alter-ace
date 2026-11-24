import { unitTone } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { withAlpha } from '../palette';

/**
 * Aim lines of units busy aiming (a charging Beam lance). A faint line swings after the target,
 * then freezes as a bright dashed line just before it fires (the cue to dash). Lines aimed at the
 * ace are drawn stronger.
 */
export class SightLineLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const z = view.zoom;
    for (const u of world.units) {
      const line = u.kind === 'soldier' ? u.action?.sightLine : null;
      if (!line) continue;
      const atAce = line.target.kind === 'player';
      const alpha = line.locked ? (atAce ? 0.95 : 0.55) : atAce ? 0.35 : 0.14;
      ctx.strokeStyle = withAlpha(palette.tone(unitTone(u)), alpha);
      ctx.lineWidth = (line.locked ? 2 : 1) / z;
      ctx.setLineDash(line.locked ? [10 / z, 6 / z] : []);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(u.x + Math.cos(line.angle) * line.range, u.y + Math.sin(line.angle) * line.range);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
