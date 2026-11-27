import { kick } from './impact';
import type { World } from './World';

/** Ghost images trailing the ace as it boosts off, and their spacing. */
const LAUNCH_GHOSTS = 6;
const GHOST_GAP = 14;

/** The launch sequence starts: the battle holds, with the camera `player.launch.zoom` times closer on the ace. */
export function holdForLaunch(world: World): void {
  const { camera, player } = world.catalog.battle;
  world.status.paused = true;
  world.camera.zoom = Math.min(camera.maxZoom, world.camera.zoomTarget * player.launch.zoom);
}

/**
 * The battle starts at the end of the launch sequence and the ace boosts off: east (toward the
 * enemy) at `player.launch.speed` × its top speed, which then bleeds off like any excess speed,
 * with ghost images behind it and the `impact.launch` shake and flash. The camera eases back to
 * the chosen zoom on its own.
 */
export function launchAce(world: World): void {
  world.status.paused = false;
  const P = world.player;
  if (!P?.alive) return;
  P.facing = 0;
  P.vx = P.frame.speed * world.catalog.battle.player.launch.speed;
  P.vy = 0;
  for (let i = 1; i <= LAUNCH_GHOSTS; i++) world.addFx({ type: 'ghost', x: P.x - i * GHOST_GAP, y: P.y, t: 0, life: 0.3 });
  kick(world, world.catalog.battle.impact.launch);
}
