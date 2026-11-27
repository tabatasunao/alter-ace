import type { Soldier, Unit } from '../entities';
import type { World } from '../World';

/**
 * Who an AI unit should shoot, in priority order: the ace (hunters within aceHuntRange, at any
 * distance once they stalk it, or an `aceFirst` class within its weapon's range), else the nearest
 * hostile in sight.
 */
/** The unit an `aceFirst` class's missiles switch to when it comes near them: the ace. */
export function preferredTarget(world: World, u: Soldier): Unit | null {
  const P = world.player;
  return u.def.aceFirst && P && P.alive ? P : null;
}

export function chooseTarget(world: World, u: Soldier): Unit | null {
  const P = world.player;
  if (u.def.aceFirst && !u.stalking) {
    const r = u.weapon.range;
    if (P && P.alive && (P.x - u.x) ** 2 + (P.y - u.y) ** 2 <= r * r) return P;
    return world.grid.nearestHostile(u.x, u.y, u.team, world.catalog.battle.ai.sightRange);
  }
  if ((u.stalking || u.hunter) && P && P.alive) {
    const range = u.stalking ? Infinity : world.catalog.battle.balance.aceHuntRange;
    const dx = P.x - u.x;
    const dy = P.y - u.y;
    if (dx * dx + dy * dy < range * range) return P;
  }
  return world.grid.nearestHostile(u.x, u.y, u.team, world.catalog.battle.ai.sightRange);
}
