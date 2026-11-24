import type { Soldier } from '../entities';
import type { World } from '../World';
import { aimStrategy } from './aimStrategies';

interface Candidate {
  u: Soldier;
  d: number;
  s: number;
}

/** The best `k` enemies within `range` of the ace, ranked by the aim mode at `modeIndex`. */
export function pickTargets(world: World, modeIndex: number, range: number, k: number): Soldier[] {
  const P = world.player;
  if (!P) return [];
  const r2 = range * range;
  const candidates: Candidate[] = [];
  world.grid.eachNear(P.x, P.y, range, (u) => {
    if (u.team === P.team || !u.alive || u.kind !== 'soldier') return;
    const dx = u.x - P.x;
    const dy = u.y - P.y;
    const d = dx * dx + dy * dy;
    if (d <= r2) candidates.push({ u, d, s: 0 });
  });
  if (candidates.length === 0) return [];

  const strategy = aimStrategy(world.catalog.aimModes[modeIndex]!.strategy);
  const ctx = { player: P, grid: world.grid };
  for (const c of candidates) c.s = strategy.score(c.u, c.d, ctx);

  if (k === 1) {
    let best = candidates[0]!;
    for (const c of candidates) if (c.s < best.s) best = c;
    return [best.u];
  }
  candidates.sort((a, b) => a.s - b.s);
  return candidates.slice(0, k).map((c) => c.u);
}
