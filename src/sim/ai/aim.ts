import type { Unit } from '../entities';

/**
 * Angle from (x, y) toward where `target` will be after `seconds`, scaled by `lead`
 * (0 = straight at it, 1 = the full predicted position).
 */
export function aimAhead(x: number, y: number, target: Unit, seconds: number, lead: number): number {
  const k = seconds * lead;
  return Math.atan2(target.y + target.vy * k - y, target.x + target.vx * k - x);
}

/**
 * Seconds until a projectile of `speed` fired from (x, y) can meet a target moving in a straight
 * line: the smallest t > 0 with |d + v·t| = speed·t, a quadratic in t. Falls back to the straight-line
 * flight time when there is no solution (a target faster than the shot, running away).
 */
function interceptTime(x: number, y: number, target: Unit, speed: number): number {
  const dx = target.x - x;
  const dy = target.y - y;
  const a = target.vx * target.vx + target.vy * target.vy - speed * speed;
  const b = 2 * (dx * target.vx + dy * target.vy);
  const c = dx * dx + dy * dy;
  const straight = Math.sqrt(c) / speed;
  if (Math.abs(a) < 1e-6) return b < 0 ? -c / b : straight;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return straight;
  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  const t = t1 > 0 && t2 > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  return t > 0 ? t : straight;
}

/** Close-quarters fire settings (battle.json → ai.closeAim). */
export interface CloseAim {
  readonly range: number;
  readonly lead: number;
  readonly spread: number;
  readonly fireRate: number;
}

/**
 * How far inside close-quarters range a unit's target is: 0 at the edge or beyond, 1 at point
 * blank. Only the ace counts as a close-quarters target.
 */
export function closeness(target: Unit, distance: number, c: CloseAim): number {
  return target.kind === 'player' && c.range > 0 && distance < c.range ? 1 - distance / c.range : 0;
}

/** A weapon's lead at closeness `k`: rising linearly toward `closeAim.lead`, never below its own. */
export function closeLead(lead: number, k: number, c: CloseAim): number {
  return c.lead <= lead ? lead : lead + (c.lead - lead) * k;
}

/** A weapon's spread at closeness `k`: narrowing linearly toward × `closeAim.spread`. */
export function closeSpread(spread: number, k: number, c: CloseAim): number {
  return spread * (1 - (1 - c.spread) * k);
}

/** How many times as often a unit fires at closeness `k`: rising linearly toward `closeAim.fireRate`. */
export function closeFireRate(k: number, c: CloseAim): number {
  return 1 + (c.fireRate - 1) * k;
}

/** Angle to fire a projectile of `speed` from (x, y) at a moving target, `lead` of the way to the intercept point. */
export function leadAngle(x: number, y: number, target: Unit, speed: number, lead: number): number {
  return aimAhead(x, y, target, interceptTime(x, y, target, speed), lead);
}
