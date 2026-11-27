import { TAU } from '../../core/math';
import type { RailWeapon, SniperWeapon, WeaponBehaviorName } from '../../data/types';
import type { Player, Unit, WeaponSlot } from '../../sim/entities';
import { steadyFull, steadyShare } from '../../sim/weapons/behaviors/rail';
import type { Palette } from '../palette';

/** Radius of the HP arc around the ace; the dash marker and the steady-aim gauge sit just outside it. */
export const VITALS_RADIUS = 21;

/** The reticle brackets around the target: line width, extra distance out, and whether they flash white. */
export interface Brackets {
  readonly width: number;
  readonly out: number;
  readonly flash: boolean;
}

export const PLAIN_BRACKETS: Brackets = { width: 2, out: 0, flash: false };

/**
 * Aim feedback for the active weapon's behavior, drawn by PlayerLayer: the reticle brackets, a mark
 * over the target, and a gauge next to the ace. Every part is optional.
 *
 * To add one: implement this and add it to `createWeaponOverlays` under the behavior's name.
 */
export interface WeaponOverlay {
  /** Runs every frame the weapon is active (keeps any state the other parts read). */
  update?(slot: WeaponSlot, P: Player, now: number): void;
  brackets?(slot: WeaponSlot, P: Player): Brackets;
  /** Over the reticle's target, after the brackets. */
  target?(ctx: CanvasRenderingContext2D, slot: WeaponSlot, P: Player, target: Unit, palette: Palette): void;
  /** Next to the ace, after its body. Not drawn once the sortie is over. */
  ace?(ctx: CanvasRenderingContext2D, slot: WeaponSlot, P: Player, palette: Palette, zoom: number): void;
}

/** One set of overlays per PlayerLayer (some keep state between frames). */
export function createWeaponOverlays(): Partial<Record<WeaponBehaviorName, WeaponOverlay>> {
  return { rail: new SteadyAimOverlay(), sniper: sightLineOverlay };
}

/** Reticle bracket thickness for a steady-aim weapon, from weakest to strongest. */
const STEADY_BRACKET = { thin: 1, thick: 4.5 };
/** Reaching full strength: the brackets snap in from this far out, flashing, over this long. */
const SNAP = { out: 7, time: 0.18 };
/** Angular length of the steady-aim gauge above the ace. */
const STEADY_ARC = Math.PI / 2;

/**
 * Steady aim (Railgun). The brackets are thin at top speed and thick at rest, and snap in with a
 * flash when the shot reaches full strength. An arc above the ace fills as it slows (empty at top
 * speed, full at rest), in the kinetic color; at full strength it turns white and thick, with a
 * pulse when it gets there.
 */
class SteadyAimOverlay implements WeaponOverlay {
  /** When the weapon last reached full strength (world time), or -1. */
  private fullSince = -1;
  private full = false;
  /** The snap-in, from 1 when full strength is reached down to 0. */
  private snap = 0;
  /** World time of the last update: a gap means the weapon was put away, so the snap starts over. */
  private lastUpdate = -1;

  update(slot: WeaponSlot, P: Player, now: number): void {
    const w = slot.def as RailWeapon;
    if (now - this.lastUpdate > 0.1) this.fullSince = -1;
    this.lastUpdate = now;
    this.full = steadyFull(w, P);
    if (this.full && this.fullSince < 0) this.fullSince = now;
    if (!this.full) this.fullSince = -1;
    this.snap = this.full ? Math.max(0, 1 - (now - this.fullSince) / SNAP.time) : 0;
  }

  brackets(slot: WeaponSlot, P: Player): Brackets {
    const w = slot.def as RailWeapon;
    if (!w.steady) return PLAIN_BRACKETS;
    const share = steadyShare(w, P, w.steady.still * w.steady.fullBonus);
    return { width: STEADY_BRACKET.thin + share * (STEADY_BRACKET.thick - STEADY_BRACKET.thin), out: SNAP.out * this.snap, flash: this.snap > 0 };
  }

  ace(ctx: CanvasRenderingContext2D, slot: WeaponSlot, P: Player, palette: Palette, z: number): void {
    const w = slot.def as RailWeapon;
    if (!w.steady) return;
    const { full, snap } = this;
    const fill = steadyShare(w, P, w.steady.still);
    const base = 3 / Math.max(0.6, z);
    const r = VITALS_RADIUS + 6;
    const a0 = -Math.PI / 2 - STEADY_ARC / 2;
    ctx.lineCap = 'round';
    ctx.lineWidth = base;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = palette.muted;
    ctx.beginPath();
    ctx.arc(P.x, P.y, r, a0, a0 + STEADY_ARC);
    ctx.stroke();
    if (full) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = base * 3;
      ctx.strokeStyle = palette.damageType('kinetic');
      ctx.beginPath();
      ctx.arc(P.x, P.y, r, a0, a0 + STEADY_ARC);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = full ? 1 : 0.9;
    ctx.lineWidth = full ? base * 1.7 : base;
    ctx.strokeStyle = full ? palette.ace : palette.damageType('kinetic');
    ctx.beginPath();
    ctx.arc(P.x, P.y, r, a0, a0 + STEADY_ARC * fill);
    ctx.stroke();
    if (snap > 0) {
      ctx.globalAlpha = snap;
      ctx.lineWidth = base;
      ctx.strokeStyle = palette.ace;
      ctx.beginPath();
      ctx.arc(P.x, P.y, r + 10 * (1 - snap), a0 - 0.2, a0 + STEADY_ARC + 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }
}

/** Sniper Rifle: for the last `sight` s before each shot, a sight line locks onto the target, brightening and closing a ring around it. */
const sightLineOverlay: WeaponOverlay = {
  target(ctx, slot, P, t, palette) {
    const w = slot.def as SniperWeapon;
    if (slot.ammo <= 0 || slot.reloadT > 0 || slot.cd >= w.sight) return;
    const k = 1 - Math.max(0, slot.cd) / w.sight;
    ctx.strokeStyle = palette.damageType('beam');
    ctx.globalAlpha = 0.3 + 0.6 * k;
    ctx.lineWidth = 1 + 2 * k;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size * 0.5 + 5 + 16 * (1 - k), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};
