import type { Player, Status, StatusStat } from './entities';

/**
 * The ace's timed statuses (from tools like Overboost and Repair Nanites). A status scales stats
 * and/or heals; systems ask `statMul` instead of knowing which tool is running.
 */

/** Adds a status, replacing a running one from the same tool (so using a tool again refreshes it). */
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

/** Whether a running status makes every weapon hardpoint fire at once (super release). */
export function firesAllWeapons(P: Player): boolean {
  return P.statuses.some((s) => s.allWeapons);
}

/** Runs the statuses down, applies their healing, and drops the expired ones. */
export function tickStatuses(P: Player, dt: number): void {
  for (const s of P.statuses) {
    s.remaining -= dt;
    if (s.heal) P.hp = Math.min(P.maxHp, P.hp + s.heal * dt);
  }
  if (P.statuses.some((s) => s.remaining <= 0)) P.statuses = P.statuses.filter((s) => s.remaining > 0);
}
