import { TAU } from '../../core/math';
import type { Effect, EffectType, HitResult } from '../../sim/entities';
import { withAlpha, type Palette } from '../palette';
import { t, tm } from '../../i18n';

/**
 * Draws one visual effect. `k` is its age from 0 to 1. Globals like alpha are reset by EffectLayer.
 * To add an effect: add it to the Effect union (src/sim/entities.ts) and register a painter here.
 */
export interface EffectPainter<E extends Effect = Effect> {
  paint(ctx: CanvasRenderingContext2D, f: E, k: number, palette: Palette): void;
}

/** Seconds the hit marker's burst or ring plays (its label, if any, lasts longer). */
const MARKER_TIME = 0.3;
/** Translation keys of the hit labels. */
const HIT_LABELS: Readonly<Record<HitResult, string>> = { critical: 'hit.critical', resisted: 'hit.resisted', shielded: 'hit.shielded', exposed: 'hit.exposed' };
/** Every translated word drawn on the canvas (hit labels and callouts), for preloading their glyphs. */
export const CANVAS_TEXT_KEYS: readonly string[] = [...Object.values(HIT_LABELS), 'callout.fullArmsReady', 'callout.dodge', 'callout.clash', 'callout.kills'];

/** A Railgun slug crosses its whole line in this many seconds (the hit itself is instant). */
const SLUG_TRAVEL = 0.06;
/** A full-strength slug's coiled discharge: wavelength along the wake, and step between points. */
const COIL = { wave: 46, step: 6 };

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
  line: {
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
  // The Railgun slug: a white-hot dart races down the line in a few frames, leaving a wake (kinetic
  // glow around a thin white core) that thins and fades. A short spark cone flashes at the muzzle.
  // A full-strength shot adds two coils of discharge twisting along the wake and a shock ring.
  slug: {
    paint(ctx, f, k, palette) {
      const dx = f.x2 - f.x;
      const dy = f.y2 - f.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const p = Math.min(1, f.t / SLUG_TRAVEL);
      const hx = f.x + dx * p;
      const hy = f.y + dy * p;
      const fade = 1 - k;
      const glow = palette.damageType('kinetic');
      const hot = palette.ace;
      const w = f.width;
      const stroke = (x1: number, y1: number, x2: number, y2: number, width: number, style: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      ctx.lineCap = 'round';

      // The wake.
      ctx.globalCompositeOperation = 'lighter';
      stroke(f.x, f.y, hx, hy, w * (0.45 + 0.55 * fade), glow, 0.32 * fade);
      ctx.globalCompositeOperation = 'source-over';
      stroke(f.x, f.y, hx, hy, Math.max(1, w * 0.2 * fade), hot, fade);

      if (f.full) {
        // Two coils of discharge twisting along the wake, turning as they fade.
        const amp = w * 0.85 * (0.4 + 0.6 * fade);
        const reach = len * p;
        ctx.lineWidth = Math.max(1, w * 0.12);
        ctx.strokeStyle = hot;
        ctx.globalAlpha = 0.85 * fade;
        for (const phase of [0, Math.PI]) {
          ctx.beginPath();
          for (let d = 0; d <= reach; d += COIL.step) {
            const o = amp * Math.sin((d / COIL.wave) * TAU + phase + f.t * 40);
            const x = f.x + ux * d - uy * o;
            const y = f.y + uy * d + ux * o;
            if (d === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // A shock ring bursting off the muzzle.
        ctx.globalAlpha = 0.8 * fade;
        ctx.lineWidth = 1 + 3 * fade;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 12 + 70 * Math.sqrt(k), 0, TAU);
        ctx.stroke();
      }

      // The slug itself, while it flies.
      if (p < 1) {
        const L = (16 + w * 2.2) * (f.full ? 1.4 : 1);
        ctx.globalCompositeOperation = 'lighter';
        stroke(hx - ux * L, hy - uy * L, hx, hy, w * (f.full ? 1.2 : 0.9), glow, 0.8);
        ctx.globalCompositeOperation = 'source-over';
        stroke(hx - ux * L * 0.6, hy - uy * L * 0.6, hx, hy, Math.max(2, w * 0.45), hot, 1);
      }

      // Muzzle sparks: a short forward cone, gone in a tenth of a second.
      const m = 1 - Math.min(1, f.t / 0.1);
      if (m > 0) {
        const ray = (12 + w * 2) * m * (f.full ? 1.5 : 1);
        for (const spread of [-0.45, -0.2, 0.2, 0.45]) {
          const c = Math.cos(spread);
          const sn = Math.sin(spread);
          const rx = ux * c - uy * sn;
          const ry = uy * c + ux * sn;
          stroke(f.x, f.y, f.x + rx * ray, f.y + ry * ray, Math.max(1, w * 0.15), hot, m);
        }
      }
      ctx.lineCap = 'butt';
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
      const text = tm(f.msg);
      ctx.strokeText(text, f.x, y);
      ctx.fillStyle = palette.tone(f.tone);
      ctx.fillText(text, f.x, y);
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
        const text = t(HIT_LABELS[f.result]);
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
