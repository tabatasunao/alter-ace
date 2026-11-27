import { clamp } from '../../core/math';
import type { Soldier } from '../entities';
import type { World } from '../World';

/**
 * Moves a unit at (vx, vy) for `dt` seconds, kept inside the battlefield's edge margin. Shared by
 * the unit actions that take over a unit's movement (lunges, hops, knockbacks).
 */
export function moveUnit(world: World, u: Soldier, vx: number, vy: number, dt: number): void {
  const margin = world.catalog.battle.ai.edgeMargin;
  u.vx = vx;
  u.vy = vy;
  u.x = clamp(u.x + vx * dt, margin, world.width - margin);
  u.y = clamp(u.y + vy * dt, margin, world.height - margin);
}
