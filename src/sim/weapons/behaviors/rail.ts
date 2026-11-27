import { clamp } from '../../../core/math';
import type { RailWeapon } from '../../../data/types';
import { strikeLine } from '../../attacks';
import { kick } from '../../impact';
import { aceHit, type Player } from '../../entities';
import type { World } from '../../World';
import { speedFraction } from '../../statuses';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** Whether the ace is slow enough for a full-strength steady-aim shot. */
export function steadyFull(w: RailWeapon, P: Player): boolean {
  return !!w.steady && speedFraction(P) < w.steady.fullBelow;
}

/** Steady aim: the damage (and line width) multiplier for the ace's current speed. */
export function steadyMul(w: RailWeapon, P: Player): number {
  const s = w.steady;
  if (!s) return 1;
  return steadyFull(w, P) ? s.still * s.fullBonus : s.still + (s.moving - s.still) * speedFraction(P);
}

/**
 * How steady the aim is, 0 at top speed to 1 when the damage multiplier reaches `top` (the
 * standstill `still`, or `still × fullBonus` to count full strength).
 */
export function steadyShare(w: RailWeapon, P: Player, top: number): number {
  const s = w.steady;
  if (!s) return 1;
  return clamp((steadyMul(w, P) - s.moving) / Math.max(1e-6, top - s.moving), 0, 1);
}

/**
 * Instant hit on every enemy along the line out to full range, hardest from a standstill (Railgun).
 * Drawn as a slug; a full-strength shot that hits lands with a brief hit-stop.
 */
export const rail: WeaponBehavior<RailWeapon> = {
  fire({ world, player: P, weapon: w, angle }) {
    const k = steadyMul(w, P);
    const full = steadyFull(w, P);
    const hits = slug(world, P, w, angle, k, full);
    if (full && hits > 0) kick(world, world.catalog.battle.impact.railFull);
    return 1;
  },
  burst(ctx) {
    for (let i = 0; i < ctx.count; i++) slug(ctx.world, ctx.player, ctx.weapon, burstAngle(ctx), 1, false);
  },
};

/** Seconds the slug's wake stays on screen. */
const SLUG_LIFE = 0.45;

/** One Railgun shot at strength `k`: strikes the line and draws the slug. Returns how many units it hit. */
function slug(world: World, P: Player, w: RailWeapon, angle: number, k: number, full: boolean): number {
  const { x2, y2, hits } = strikeLine(world, P, angle, { range: w.range, width: w.hitWidth, dmg: w.dmg * k }, aceHit(w));
  world.addFx({ type: 'slug', x: P.x, y: P.y, x2, y2, t: 0, life: SLUG_LIFE, tone: 'ace', width: w.hitWidth * k, full });
  return hits;
}
