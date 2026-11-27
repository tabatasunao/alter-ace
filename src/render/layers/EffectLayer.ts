import type { Effect } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { recolorTone, type Palette } from '../palette';
import { EFFECT_PAINTERS, type EffectPainter } from '../painters/effectPainters';

/**
 * Explosions, debris, sparks, slashes and other short-lived visuals. While Full Arms runs, the
 * ace's own attack effects (slugs, beams, slashes: the `ace` tone) draw their glow and trails in
 * the Full Arms color around their white cores.
 */
export class EffectLayer implements WorldLayer {
  /** The palette with the ace tone in the Full Arms color, kept for the palette it was made from. */
  private fullArms: { base: Palette; palette: Palette } | null = null;

  draw({ ctx, world, palette }: WorldFrame): void {
    const fullArms = world.player?.release ? this.fullArmsPalette(palette) : null;
    for (const f of world.fx) {
      const p = fullArms && 'tone' in f && f.tone === 'ace' ? fullArms : palette;
      (EFFECT_PAINTERS[f.type] as EffectPainter<Effect>).paint(ctx, f, f.t / f.life, p);
    }
    ctx.globalAlpha = 1;
  }

  private fullArmsPalette(base: Palette): Palette {
    if (this.fullArms?.base !== base) this.fullArms = { base, palette: recolorTone(base, 'ace', 'release') };
    return this.fullArms.palette;
  }
}
