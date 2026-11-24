import type { Effect } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { EFFECT_PAINTERS, type EffectPainter } from '../painters/effectPainters';

/** Explosions, debris, sparks, slashes and other short-lived visuals. */
export class EffectLayer implements WorldLayer {
  draw({ ctx, world, palette }: WorldFrame): void {
    for (const f of world.fx) {
      (EFFECT_PAINTERS[f.type] as EffectPainter<Effect>).paint(ctx, f, f.t / f.life, palette);
    }
    ctx.globalAlpha = 1;
  }
}
