import { TAU } from '../../core/math';
import type { Player } from '../../sim/entities';
import type { WorldFrame, WorldLayer } from '../layers';
import { createWeaponOverlays, PLAIN_BRACKETS, VITALS_RADIUS } from '../painters/weaponOverlays';

const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** Angular length of the dash marker under the ace. */
const DASH_ARC = Math.PI / 3;

/** How much the ace stretches along a saber lunge (and squashes across it). */
const LUNGE_STRETCH = 1.45;

/** Jolt of the ace's body at the start of a full-strength hit, in world units. */
const HURT_JOLT = 5;

/**
 * The ace: weapon range ring, the Full Arms gauge ring at the close-kill radius (kills that close
 * charge the gauge faster), reticle on the current target with the active weapon's aim feedback
 * (WeaponOverlay), and the frame. A hit makes the frame jolt and blink red, then dark, before it
 * settles.
 */
export class PlayerLayer implements WorldLayer {
  private readonly overlays = createWeaponOverlays();

  draw({ ctx, world, palette, view }: WorldFrame): void {
    const P = world.player;
    if (!P || !P.alive) return;
    const z = view.zoom;
    const over = world.status.over;

    const slot = P.slots[P.active];
    const overlay = slot ? this.overlays[slot.def.behavior] : undefined;
    if (slot) overlay?.update?.(slot, P, world.t);
    if (slot && !over) {
      ctx.strokeStyle = palette.ring;
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([6 / z, 6 / z]);
      ctx.beginPath();
      ctx.arc(P.x, P.y, slot.def.range, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!P.release && !over) {
      // The close-kill ring builds up clockwise as the release gauge fills, then pulses when full.
      const close = world.catalog.battle.player.superRelease.charge.closeRadius;
      ctx.strokeStyle = palette.release;
      if (P.releaseCharge >= 1) {
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(world.impact.clock * 5);
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(P.x, P.y, close, 0, TAU);
        ctx.stroke();
      } else {
        ctx.lineWidth = 1 / z;
        ctx.globalAlpha = 0.06;
        ctx.beginPath();
        ctx.arc(P.x, P.y, close, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(P.x, P.y, close, -Math.PI / 2, -Math.PI / 2 + TAU * P.releaseCharge);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const t = P.reticle;
    if (t && t.alive && !over) {
      ctx.strokeStyle = palette.aimLine;
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      const b = (slot && overlay?.brackets?.(slot, P)) ?? PLAIN_BRACKETS;
      const r = t.size * 0.5 + 7 + b.out;
      const L = 6;
      ctx.strokeStyle = b.flash ? palette.ace : palette.accent;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      for (const [sx, sy] of CORNERS) {
        const cx = t.x + sx * r;
        const cy = t.y + sy * r;
        ctx.moveTo(cx - sx * L, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - sy * L);
      }
      ctx.stroke();

      if (slot) overlay?.target?.(ctx, slot, P, t, palette);
    }

    this.drawThrust(ctx, P, palette.accent, world.t, over);

    const react = world.catalog.battle.impact.aceHit.react || 1;
    const hurt = P.hurtT > 0 ? P.hurtT / react : 0;
    const jolt = HURT_JOLT * P.hurtK * hurt;
    const clock = world.impact.clock;
    ctx.save();
    ctx.translate(P.x + jolt * Math.sin(clock * 120), P.y + jolt * 0.6 * Math.cos(clock * 97));
    if (P.lunge) {
      // Stretched along the lunge, squashed across it.
      ctx.rotate(Math.atan2(P.lunge.vy, P.lunge.vx));
      ctx.scale(LUNGE_STRETCH, 1 / LUNGE_STRETCH);
    } else {
      ctx.rotate(P.facing + 0.012 * jolt * Math.sin(clock * 70));
    }
    if (P.iframes > 0) ctx.globalAlpha = 0.6;
    if (P.statuses.some((s) => s.ring)) {
      ctx.strokeStyle = palette.release;
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -15, 30, 30);
    }
    ctx.fillStyle = hurt > 0.6 ? palette.danger : hurt > 0.35 ? palette.field : palette.ace;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(8, -3, 9, 6);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-11.5, -11.5, 23, 23);
    ctx.restore();
    if (!over) this.drawVitals(ctx, P, world.catalog.battle.alerts.criticalHp, palette, z);
    if (!over && slot) overlay?.ace?.(ctx, slot, P, palette, z);
  }

  /**
   * Next to the ace, where the eyes are: an HP arc while it is hurt (red when critical), and a dash
   * marker underneath that fills as the dash recharges and lights up when it is ready.
   */
  private drawVitals(ctx: CanvasRenderingContext2D, P: Player, criticalHp: number, palette: WorldFrame['palette'], z: number): void {
    const hp = Math.max(0, P.hp / P.maxHp);
    const w = 3 / Math.max(0.6, z);
    if (hp < 0.999) {
      const start = -Math.PI / 2;
      ctx.lineWidth = w;
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = palette.muted;
      ctx.beginPath();
      ctx.arc(P.x, P.y, VITALS_RADIUS, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = hp < criticalHp ? palette.danger : palette.ace;
      ctx.beginPath();
      ctx.arc(P.x, P.y, VITALS_RADIUS, start, start + TAU * hp);
      ctx.stroke();
    }
    const ready = P.dashCd <= 0;
    const fill = ready ? 1 : 1 - P.dashCd / P.frame.dashCd;
    const a0 = Math.PI / 2 - DASH_ARC / 2;
    ctx.lineWidth = w;
    ctx.globalAlpha = ready ? 0.95 : 0.3;
    ctx.strokeStyle = ready ? palette.accent : palette.muted;
    ctx.beginPath();
    ctx.arc(P.x, P.y, VITALS_RADIUS + 6, a0, a0 + DASH_ARC * fill);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Exhaust flame opposite the thrust input, so thrust and drift read separately. */
  private drawThrust(ctx: CanvasRenderingContext2D, P: Player, color: string, time: number, over: boolean): void {
    const thrust = Math.hypot(P.input.x, P.input.y);
    if (thrust < 0.1 || P.dash || P.lunge || over) return;
    const nx = P.input.x / thrust;
    const ny = P.input.y / thrust;
    const length = 8 + 8 * thrust + 3 * Math.sin(time * 50);
    const bx = P.x - nx * 11;
    const by = P.y - ny * 11;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx - ny * 5, by + nx * 5);
    ctx.lineTo(bx - nx * length, by - ny * length);
    ctx.lineTo(bx + ny * 5, by - nx * 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
