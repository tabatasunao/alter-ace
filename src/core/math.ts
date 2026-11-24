export const TAU = Math.PI * 2;

export interface Point {
  x: number;
  y: number;
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Wraps an angle into (-π, π]. */
export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Distance from point P to segment AB. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const sx = bx - ax;
  const sy = by - ay;
  const l2 = sx * sx + sy * sy;
  let t = l2 ? ((px - ax) * sx + (py - ay) * sy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + sx * t - px;
  const dy = ay + sy * t - py;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Splits `items` into groups of ceil(n / k) (so possibly fewer than k groups). */
export function chunks<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const size = Math.max(1, Math.ceil(items.length / k));
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** 83 → "1:23". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
