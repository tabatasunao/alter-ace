import type { World } from './World';

/** Position fields a unit, shot or effect may carry; each is moved by a shift. */
const XS = ['x', 'x2', 'sx', 'tx'] as const;
const YS = ['y', 'y2', 'sy', 'ty'] as const;

/**
 * How far to move the battle so that (x, y) lands nearest the middle of the battlefield, in whole
 * steps of `step`. With `step` a multiple of the ground grid's spacing, the grid looks the same after.
 */
export function recenterOffset(world: World, x: number, y: number, step: number): { dx: number; dy: number } {
  return {
    dx: Math.round((world.width / 2 - x) / step) * step,
    dy: Math.round((world.height / 2 - y) / step) * step,
  };
}

function shift(o: object, dx: number, dy: number): void {
  const r = o as Record<string, unknown>;
  for (const k of XS) if (typeof r[k] === 'number') r[k] = (r[k] as number) + dx;
  for (const k of YS) if (typeof r[k] === 'number') r[k] = (r[k] as number) + dy;
}

/**
 * Moves everything in the battle by (dx, dy): units, shots, effects and the camera, so nothing
 * changes on screen and the ace keeps its motion.
 */
export function shiftWorld(world: World, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  for (const u of world.units) shift(u, dx, dy);
  for (const p of world.shots) shift(p, dx, dy);
  for (const f of world.fx) shift(f, dx, dy);
  world.camera.x += dx;
  world.camera.y += dy;
  world.grid.rebuild(world.units);
}
