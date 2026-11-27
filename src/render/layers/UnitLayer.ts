import { TAU } from '../../core/math';
import { ENEMY, unitTone, type Soldier } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { withAlpha } from '../palette';
import { UNIT_PAINTERS, unitShape } from '../painters/unitPainters';

const CULL_MARGIN = 30;
/** A hit flash shows light for its first part, then dark for the rest, so it keeps its contrast. */
const FLASH_DARK_BELOW = 0.035;
/** Corner directions for the exposed brackets. */
const EXPOSED_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
/** Judder amplitude of a staggered unit at the start of its stagger, in world units. */
const STAGGER_AMPLITUDE = 3;
/** Boost glow radius as a multiple of unit size: around an enemy Commander, and around a unit its aura boosts. */
const GLOW_SOURCE = 1.35;
const GLOW_BOOSTED = 1.05;

/** A soft round glow in one color, drawn once and reused for every glowing unit. */
let glowSprite: { color: string; canvas: HTMLCanvasElement } | null = null;
function glow(color: string): HTMLCanvasElement {
  if (glowSprite?.color === color) return glowSprite.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, withAlpha(color, 0));
  g.globalAlpha = 0.5;
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowSprite = { color, canvas };
  return canvas;
}

/**
 * How strongly an enemy unit glows magenta, 0 for no glow: an enemy Commander (a class with an aura)
 * always, and each unit its aura is boosting, fading out as the boost runs out.
 */
function boostGlow(u: Soldier, buffTime: number): number {
  if (u.team !== ENEMY) return 0;
  if (u.def.aura) return 1;
  return u.buffT > 0 ? Math.min(1, u.buffT / buffTime) : 0;
}

/**
 * AI units, with hit flashes, stagger judder, stun outlines and HP bars. The ace is
 * drawn by PlayerLayer.
 */
export class UnitLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const x0 = view.x0 - CULL_MARGIN;
    const x1 = view.x1 + CULL_MARGIN;
    const y0 = view.y0 - CULL_MARGIN;
    const y1 = view.y1 + CULL_MARGIN;
    const staggerTime = world.catalog.battle.impact.stagger.time || 1;
    const buffTime = world.catalog.battle.ai.auraBuffTime || 1;
    for (const u of world.units) {
      if (u.kind === 'player') continue;
      const s = u.size;
      const h = s / 2;
      const { x, y } = u;
      if (x + h < x0 || x - h > x1 || y + h < y0 || y - h > y1) continue;

      const strength = boostGlow(u, buffTime);
      if (strength > 0) {
        const r = s * (u.def.aura ? GLOW_SOURCE : GLOW_BOOSTED);
        ctx.globalAlpha = strength;
        ctx.drawImage(glow(palette.semiAce), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }

      const tone = unitTone(u);
      const teamColor = palette.tone(tone);
      const color = u.flash > FLASH_DARK_BELOW ? palette.ace : u.flash > 0 ? palette.field : teamColor;
      if (u.stagger > 0) {
        const jx = STAGGER_AMPLITUDE * (u.stagger / staggerTime) * Math.sin(world.impact.clock * 140 + u.id);
        ctx.save();
        ctx.translate(jx, 0);
        UNIT_PAINTERS[unitShape(u)]?.paint(ctx, u, color, palette);
        ctx.restore();
      } else {
        UNIT_PAINTERS[unitShape(u)]?.paint(ctx, u, color, palette);
      }

      if (u.leader) {
        // A pack member: a small pip in its leader's color.
        ctx.fillStyle = palette.tone(unitTone(u.leader));
        ctx.fillRect(x - h - 3, y - h - 3, 3, 3);
      }
      if (u.shieldT > 0) {
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
      if (u.exposedT > 0) {
        // Exposed: pulsing corner brackets in the accent color, outside the stun outline.
        const e = h + 7;
        const L = 5;
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(world.impact.clock * 14);
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [sx, sy] of EXPOSED_CORNERS) {
          ctx.moveTo(x + sx * e, y + sy * (e - L));
          ctx.lineTo(x + sx * e, y + sy * e);
          ctx.lineTo(x + sx * (e - L), y + sy * e);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (u.hp < u.maxHp) {
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
