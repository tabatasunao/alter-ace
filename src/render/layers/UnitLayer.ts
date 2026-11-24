import { TAU } from '../../core/math';
import { unitTone } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { UNIT_PAINTERS, paintDecoy } from '../painters/unitPainters';

const CULL_MARGIN = 30;

/** AI units and decoys, with stun outlines and HP bars. The ace is drawn by PlayerLayer. */
export class UnitLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const x0 = view.x0 - CULL_MARGIN;
    const x1 = view.x1 + CULL_MARGIN;
    const y0 = view.y0 - CULL_MARGIN;
    const y1 = view.y1 + CULL_MARGIN;
    for (const u of world.units) {
      if (u.kind === 'player') continue;
      const s = u.size;
      const h = s / 2;
      const { x, y } = u;
      if (x + h < x0 || x - h > x1 || y + h < y0 || y - h > y1) continue;

      const tone = unitTone(u);
      const teamColor = palette.tone(tone);
      if (u.kind === 'decoy') {
        paintDecoy(ctx, u, palette, world.t);
      } else {
        UNIT_PAINTERS[u.def.shape]?.paint(ctx, u, u.flash > 0 ? palette.ace : teamColor, palette);
      }

      if (u.kind === 'soldier' && u.leader) {
        // A pack member: a small pip in its leader's color.
        ctx.fillStyle = palette.tone(unitTone(u.leader));
        ctx.fillRect(x - h - 3, y - h - 3, 3, 3);
      }
      if (u.kind === 'soldier' && u.shieldT > 0) {
        // A raised semi-ace shield: a bright bubble that flickers in its last half second.
        const flicker = u.shieldT > 0.5 || ((world.t * 20) | 0) % 2 === 0;
        if (flicker) {
          ctx.fillStyle = palette.aura(tone);
          ctx.strokeStyle = teamColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, s + 4, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
      if (u.stunT > 0) {
        ctx.strokeStyle = palette.emp;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - h - 3, y - h - 3, s + 6, s + 6);
      }
      if (u.hp < u.maxHp && u.kind !== 'decoy') {
        const bw = s + 6;
        const f = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = palette.gridMajor;
        ctx.fillRect(x - bw / 2, y - h - 6, bw, 2.5);
        ctx.fillStyle = teamColor;
        ctx.fillRect(x - bw / 2, y - h - 6, bw * f, 2.5);
      }
    }
  }
}
