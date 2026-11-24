import type { Point } from '../../core/math';
import type { Soldier } from '../entities';
import { activePlayer } from '../System';
import type { World } from '../World';

/**
 * Where a leashed unit must head instead of fighting freely, or null to fight as usual:
 * - a pack member keeps within its rally `follow` distance of its leader;
 * - an enemy semi-ace (`nearAce`) that is stalking the ace (StalkSystem) stays on the player's screen.
 */
export function leashHeading(world: World, u: Soldier): Point | null {
  if (u.leader) return toward(u, u.leader, u.leader.def.rally?.follow ?? 0);
  const reach = u.def.nearAce;
  if (!reach || !u.stalking) return null;
  const P = activePlayer(world);
  return P ? toward(u, P, reach) : null;
}

/** The heading from `u` to `to`, if it is farther than `reach`. */
function toward(u: Point, to: Point, reach: number): Point | null {
  const dx = to.x - u.x;
  const dy = to.y - u.y;
  const d = Math.hypot(dx, dy);
  return d > reach ? { x: dx / d, y: dy / d } : null;
}
