import type { Player } from './entities';
import { kick } from './impact';
import { addStatus } from './statuses';
import { burstAll } from './weapons/firing';
import type { World } from './World';

export { chargeRelease } from './releaseCharge';

/** The status that makes every weapon hardpoint fire during super release. */
export const RELEASE_STATUS = 'superRelease';

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
