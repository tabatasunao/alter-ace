import type { Player } from './entities';
import { msg } from './messages';
import type { World } from './World';

/**
 * Adds to the super release gauge, up to full. Nothing charges it while a release runs. Filling
 * it sends a ping wave out to the close-kill radius and a RELEASE READY callout.
 * Kept apart from release.ts, which imports the weapon registry: attack shapes charge the gauge
 * (near misses), and weapon behaviors import attack shapes.
 */
export function chargeRelease(world: World, P: Player, amount: number): void {
  if (P.release || P.releaseCharge >= 1) return;
  P.releaseCharge = Math.min(1, P.releaseCharge + amount);
  if (P.releaseCharge < 1) return;
  const r = world.catalog.battle.player.superRelease.charge.closeRadius;
  world.addFx({ type: 'pulse', x: P.x, y: P.y, r, t: 0, life: 0.55, tone: 'release' });
  world.addFx({ type: 'callout', x: P.x, y: P.y - 34, t: 0, life: 0.9, msg: msg('callout.fullArmsReady'), tone: 'release', size: 13 });
}
