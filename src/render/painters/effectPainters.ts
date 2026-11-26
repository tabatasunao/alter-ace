import { TAU } from '../../core/math';
import type { Effect, EffectType, HitResult } from '../../sim/entities';
import { withAlpha, type Palette } from '../palette';

/**
 * Draws one visual effect. `k` is its age from 0 to 1. Globals like alpha are reset by EffectLayer.
 * To add an effect: add it to the Effect union (src/sim/entities.ts) and register a painter here.
 */
export interface EffectPainter<E extends Effect = Effect> {
  paint(ctx: CanvasRenderingContext2D, f: E, k: number, palette: Palette): void;
}

/** Seconds the hit marker's burst or ring plays (its label, if any, lasts longer). */
const MARKER_TIME = 0.3;
const HIT_LABELS: Readonly<Record<HitResult, string>> = { critical: 'CRITICAL', resisted: 'RESIST', shielded: 'SHIELD', exposed: 'EXPOSED' };

/** The heavy beam's glow layers: width as a multiple of the core's body, and opacity. */
const HEAVY_GLOW: readonly (readonly [number, number])[] = [
  [3.6, 0.05],
  [2.9, 0.07],
  [2.3, 0.1],
  [1.8, 0.15],
  [1.35, 0.22],
];

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
  // The mega-beam: it snaps open, holds, then thins out. Additive glow layers around a solid
  // colored body and a flickering white-hot core, with a starburst flare at the muzzle.
  heavyBeam: {
    paint(ctx, f, k, palette) {
      const open = Math.min(1, k / 0.08);
      const fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      const w = f.width * open * (0.3 + 0.7 * fade);
      const color = palette.tone(f.tone);
      const flicker = 0.8 + 0.2 * Math.sin(f.t * 95);
      const line = (width: number, style: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      };
      ctx.lineCap = 'round';
      // Soft glow: widening layers, each fainter, added together.
      ctx.globalCompositeOperation = 'lighter';
      for (const [scale, alpha] of HEAVY_GLOW) line(w * scale, color, alpha * fade);
      ctx.globalCompositeOperation = 'source-over';
      line(w, color, 0.95 * fade);
      line(w * 0.45 * flicker, palette.ace, fade);

      // Muzzle flare: a soft halo, tapered rays of uneven length turning slowly, and a hot center.
      const a0 = Math.atan2(f.y2 - f.y, f.x2 - f.x);
      const r = f.width * (1.2 + 0.6 * open) * fade;
      if (r <= 0) return;
      const halo = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 1.6);
      halo.addColorStop(0, withAlpha(color, 0.7));
      halo.addColorStop(1, withAlpha(color, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 1.6, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = palette.ace;
      ctx.globalAlpha = 0.9 * fade;
      const base = Math.max(1.5, f.width * 0.09);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = a0 + (i * TAU) / 10 + f.t * 1.5 + Math.sin(i * 12.9898 + f.x) * 0.2;
        const len = r * (1.3 + 1.1 * Math.abs(Math.sin(i * 7.31 + f.y)));
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        ctx.moveTo(f.x - cy * base, f.y + cx * base);
        ctx.lineTo(f.x + cx * len, f.y + cy * len);
        ctx.lineTo(f.x + cy * base, f.y - cx * base);
      }
      ctx.fill();
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 0.45 * flicker, 0, TAU);
      ctx.fill();
      ctx.lineCap = 'butt';
    },
  },
  // A blade trail: the arc sweeps open behind the blade, then glows and fades. A soft fan marks
  // the cut; additive glow around a white core keeps it reading as a beam blade.
  slash: {
    paint(ctx, f, k, palette) {
      const sweep = Math.min(1, k / 0.28);
      const fade = k < 0.28 ? 1 : 1 - (k - 0.28) / 0.72;
      const color = palette.tone(f.tone);
      const a0 = f.a - f.half;
      const a1 = a0 + 2 * f.half * sweep;
      const r = f.r * 0.82;
      // The cut: a soft fan over the slashed area, and a thin shock edge at full reach.
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.arc(f.x, f.y, f.r, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 + 0.08 * k), a0, a1);
      ctx.stroke();
      // The blade trail, sized to the reach: additive glow around a solid body and a white core.
      ctx.lineCap = 'round';
      const arc = (width: number, style: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, a0, a1);
        ctx.stroke();
      };
      const w = f.r * (0.4 + 0.6 * fade);
      ctx.globalCompositeOperation = 'lighter';
      arc(w * 0.36, color, 0.14 * fade);
      arc(w * 0.22, color, 0.28 * fade);
      ctx.globalCompositeOperation = 'source-over';
      arc(w * 0.1 + 1, color, 0.92 * fade);
      arc(w * 0.04 + 0.8, palette.ace, fade);
      if (sweep < 1) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.ace;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a1) * r, f.y + Math.sin(a1) * r, Math.max(4, f.r * 0.06), 0, TAU);
        ctx.fill();
      }
      ctx.lineCap = 'butt';
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
  pulse: {
    paint(ctx, f, k, palette) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = palette.tone(f.tone);
      ctx.lineWidth = 3;
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
  // A big blast's first instant: a bright core inside a dark ring, readable on light and dark ground.
  flare: {
    paint(ctx, f, k, palette) {
      const r = f.r * (0.7 + 0.6 * k);
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.fillStyle = palette.field;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r + 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = palette.ace;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = palette.tone(f.tone);
      ctx.lineWidth = 2;
      ctx.stroke();
    },
  },
  // Smoke after a big blast: three muted puffs that swell, drift up and thin out.
  smoke: {
    paint(ctx, f, k, palette) {
      ctx.fillStyle = palette.muted;
      for (let i = 0; i < 3; i++) {
        const a = (i * TAU) / 3 + f.x * 0.01;
        const d = f.r * 0.35 * (0.4 + k);
        ctx.globalAlpha = 0.22 * (1 - k) * (1 - k);
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - 18 * k, f.r * (0.35 + 0.4 * k), 0, TAU);
        ctx.fill();
      }
    },
  },
  // A short word that pops in large, settles, rises a little and fades.
  callout: {
    paint(ctx, f, k, palette) {
      const pop = k < 0.12 ? 1.5 - (k / 0.12) * 0.5 : 1;
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      ctx.font = `700 ${Math.round(f.size * pop)}px ${palette.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = palette.field;
      const y = f.y - 14 * k;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = palette.tone(f.tone);
      ctx.fillText(f.text, f.x, y);
      ctx.textAlign = 'start';
    },
  },
  // One of the ace's hits that defenses changed: a burst (critical) or ring (resisted, shielded)
  // over the first moments, and, at most once in a while per unit, a short label rising off it.
  hitMarker: {
    paint(ctx, f, k, palette) {
      const critical = f.result === 'critical' || f.result === 'exposed';
      const color =
        f.result === 'critical' ? palette.damageType(f.dtype) : f.result === 'exposed' ? palette.accent : f.result === 'shielded' ? palette.ace : palette.muted;
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
