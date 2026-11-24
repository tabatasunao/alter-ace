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

/** Angle to fire a projectile of `speed` from (x, y) at a moving target, `lead` of the way to the intercept point. */
export function leadAngle(x: number, y: number, target: Unit, speed: number, lead: number): number {
  return aimAhead(x, y, target, interceptTime(x, y, target, speed), lead);
}
