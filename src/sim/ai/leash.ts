import type { Point } from '../../core/math';
import type { UnitClassDef } from '../../data/types';
import type { Soldier } from '../entities';
import { activePlayer } from '../System';
import type { World } from '../World';

/**
 * Where a leashed unit must head instead of fighting freely, or null to fight as usual:
 * - a pack member keeps within its rally `follow` distance of its leader;
 * - a class with `holdLine` keeps its place relative to its own front line;
 * - an enemy semi-ace (`nearAce`) that is stalking the ace (StalkSystem) stays on the player's screen.
 */
export function leashHeading(world: World, u: Soldier): Point | null {
  if (u.leader) return toward(u, u.leader, u.leader.def.rally?.follow ?? 0);
  if (u.def.holdLine && !u.stalking) return holdLine(world, u, u.def.holdLine);
  const reach = u.def.nearAce;
  if (!reach || !u.stalking) return null;
  const P = activePlayer(world);
  return P ? toward(u, P, reach) : null;
}

/**
 * Keeps `u` at its place relative to its own front line, whichever way the fight faces. Against the
 * nearest hostile in sight, depth = u's distance to it − the nearest teammate's distance to it (other
 * line holders do not count). Too far forward (below `depth − band`), it backs away from the
 * hostile; too far back (beyond `depth + band`), it closes in.
 */
function holdLine(world: World, u: Soldier, hold: NonNullable<UnitClassDef['holdLine']>): Point | null {
  const h = world.grid.nearestHostile(u.x, u.y, u.team, world.catalog.battle.ai.sightRange);
  if (!h) return null;
  const dx = h.x - u.x;
  const dy = h.y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  const front = hold.depth - hold.band;
  // Only a teammate within `d − front` of the hostile keeps u from being too far forward.
  const reach = d - front;
  let nearest2 = Infinity;
  if (reach > 0) {
    world.grid.eachNear(h.x, h.y, reach, (v) => {
      if (v === u || v.team !== u.team || !v.alive || (v.kind === 'soldier' && v.def.holdLine)) return;
      const d2 = (v.x - h.x) ** 2 + (v.y - h.y) ** 2;
      if (d2 <= reach * reach && d2 < nearest2) nearest2 = d2;
    });
  }
  const depth = d - Math.sqrt(nearest2);
  if (depth < front) return { x: -dx / d, y: -dy / d };
  if (depth > hold.depth + hold.band) return { x: dx / d, y: dy / d };
  return null;
}

/** The heading from `u` to `to`, if it is farther than `reach`. */
function toward(u: Point, to: Point, reach: number): Point | null {
  const dx = to.x - u.x;
  const dy = to.y - u.y;
  const d = Math.hypot(dx, dy);
  return d > reach ? { x: dx / d, y: dy / d } : null;
}
