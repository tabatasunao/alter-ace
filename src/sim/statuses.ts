import type { Player, Status, StatusStat } from './entities';

/**
 * The ace's timed statuses (Full Arms). A status scales stats; systems ask `statMul` instead of
 * knowing which status is running.
 */

/** Adds a status, replacing a running one with the same id. */
export function addStatus(P: Player, status: Status): void {
  const i = P.statuses.findIndex((s) => s.id === status.id);
  if (i >= 0) P.statuses[i] = status;
  else P.statuses.push(status);
}

/** The product of every running status's multiplier for `stat` (1 with none). */
export function statMul(P: Player, stat: StatusStat): number {
  let k = 1;
  for (const s of P.statuses) {
    const m = s.mods[stat];
    if (m !== undefined) k *= m;
  }
  return k;
}

/** How fast the ace is moving as a share of its top speed (statuses included), 0–1. */
export function speedFraction(P: Player): number {
  const top = P.frame.speed * statMul(P, 'speed');
  return top > 0 ? Math.min(1, Math.hypot(P.vx, P.vy) / top) : 0;
}

/** Whether a running status makes every weapon hardpoint fire at once (super release). */
export function firesAllWeapons(P: Player): boolean {
  return P.statuses.some((s) => s.allWeapons);
}

/** Runs the statuses down and drops the expired ones. */
export function tickStatuses(P: Player, dt: number): void {
  for (const s of P.statuses) s.remaining -= dt;
  if (P.statuses.some((s) => s.remaining <= 0)) P.statuses = P.statuses.filter((s) => s.remaining > 0);
}
