import { TAU } from '../../core/math';
import type { Effect, EffectType, HitResult } from '../../sim/entities';
import type { Palette } from '../palette';

/**
 * Draws one visual effect. `k` is its age from 0 to 1. Globals like alpha are reset by EffectLayer.
 * To add an effect: add it to the Effect union (src/sim/entities.ts) and register a painter here.
 */
export interface EffectPainter<E extends Effect = Effect> {
  paint(ctx: CanvasRenderingContext2D, f: E, k: number, palette: Palette): void;
}

/** Seconds the hit marker's burst or ring plays (its label, if any, lasts longer). */
const MARKER_TIME = 0.3;
const HIT_LABELS: Readonly<Record<HitResult, string>> = { critical: 'CRITICAL', resisted: 'RESIST', shielded: 'SHIELD' };

type EffectPainterRegistry = { readonly [T in EffectType]: EffectPainter<Extract<Effect, { type: T }>> };

export const EFFECT_PAINTERS: EffectPainterRegistry = {
  boom: {
    paint(ctx, f, k, palette) {
      const inv = 1 - k;
      const color = palette.tone(f.tone);
      const r = f.r * (0.35 + 0.65 * Math.sqrt(k));
      ctx.globalAlpha = 0.18 * inv;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = inv;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
    },
  },
  debris: {
    paint(ctx, f, k, palette) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = palette.tone(f.tone);
      ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
    },
  },
  spark: {
    paint(ctx, f, k, palette) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = palette.tone(f.tone);
      ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
    },
  },
  rail: {
    paint(ctx, f, k, palette) {
      const inv = 1 - k;
      ctx.globalAlpha = inv;
      ctx.strokeStyle = palette.tone(f.tone);
      ctx.lineWidth = 1 + (f.width - 1) * inv;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
    },
  },
  slash: {
    paint(ctx, f, k, palette) {
      const inv = 1 - k;
      ctx.globalAlpha = inv;
      ctx.strokeStyle = palette.tone(f.tone);
      ctx.lineWidth = 3 + 12 * inv;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.75 + 0.25 * k), f.a - f.half, f.a + f.half);
      ctx.stroke();
    },
  },
  emp: {
    paint(ctx, f, k, palette) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = palette.emp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * Math.sqrt(k), 0, TAU);
      ctx.stroke();
    },
  },
  ghost: {
    paint(ctx, f, k, palette) {
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.strokeStyle = palette.ace;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(f.x - 8, f.y - 8, 16, 16);
    },
  },
  // One of the ace's hits that defenses changed: a burst (critical) or ring (resisted, shielded)
  // over the first moments, and, at most once in a while per unit, a short label rising off it.
  hitMarker: {
    paint(ctx, f, k, palette) {
      const critical = f.result === 'critical';
      const color = critical ? palette.damageType(f.dtype) : f.result === 'shielded' ? palette.ace : palette.muted;
      const kb = Math.min(1, f.t / MARKER_TIME);
      if (kb < 1) {
        ctx.globalAlpha = 1 - kb;
        ctx.strokeStyle = color;
        ctx.beginPath();
        if (critical) {
          const r0 = 7 + 14 * kb;
          const r1 = r0 + 8;
          ctx.lineWidth = 2.5;
          for (let i = 0; i < 4; i++) {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
            ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
          }
        } else {
          ctx.lineWidth = 1.5;
          ctx.arc(f.x, f.y, 8 + 4 * kb, 0, TAU);
        }
        ctx.stroke();
      }
      if (f.label) {
        const text = HIT_LABELS[f.result];
        const y = f.y - 16 - 18 * k;
        ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        ctx.font = `700 ${critical ? 13 : 11}px ${palette.fontDisplay}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = palette.field;
        ctx.strokeText(text, f.x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, f.x, y);
        ctx.textAlign = 'start';
      }
    },
  },
};
