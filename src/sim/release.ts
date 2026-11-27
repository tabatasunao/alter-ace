import type { Player } from './entities';
import { kick } from './impact';
import { addStatus } from './statuses';
import { burstAll } from './weapons/firing';
import type { World } from './World';
import { msg } from './messages';

/** The status that makes every weapon hardpoint fire during super release. */
export const RELEASE_STATUS = 'superRelease';

/**
 * Adds to the super release gauge, up to full. Nothing charges it while a release runs. Filling
 * it sends a ping wave out to the close-kill radius and a RELEASE READY callout.
 */
export function chargeRelease(world: World, P: Player, amount: number): void {
  if (P.release || P.releaseCharge >= 1) return;
  P.releaseCharge = Math.min(1, P.releaseCharge + amount);
  if (P.releaseCharge < 1) return;
  const r = world.catalog.battle.player.superRelease.charge.closeRadius;
  world.addFx({ type: 'pulse', x: P.x, y: P.y, r, t: 0, life: 0.55, tone: 'release' });
  world.addFx({ type: 'callout', x: P.x, y: P.y - 34, t: 0, life: 0.9, msg: msg('callout.fullArmsReady'), tone: 'release', size: 13 });
}

/**
 * Full Arms, if the gauge is full: empties it, fires the opening burst and makes every weapon
 * hardpoint fire for the duration. The opening gives a moment of invulnerability, Full Arms cuts
 * damage taken, and the dash is ready again.
 */
export function startRelease(world: World, P: Player): boolean {
  if (P.release || P.releaseCharge < 1) return false;
  const cfg = world.catalog.battle.player.superRelease;
  P.releaseCharge = 0;
  P.release = { elapsed: 0, duration: cfg.duration, killsAtStart: world.stats.kills };
  burstAll(world, P, cfg.openingBurst);
  addStatus(P, {
    id: RELEASE_STATUS,
    remaining: cfg.duration,
    mods: { damageTaken: cfg.damageTakenMul },
    ring: true,
    allWeapons: true,
  });
  P.iframes = Math.max(P.iframes, cfg.openingIframes);
  P.dashCd = 0;
  kick(world, world.catalog.battle.impact.release);
  return true;
}
