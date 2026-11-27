import type { Unit } from './entities';
import { kick } from './impact';
import { chargeRelease } from './release';
import type { World } from './World';
import { msg } from './messages';

/**
 * A hostile attack touched a unit that cannot be hit. If that unit is the ace inside a dash's
 * invulnerability, it is a close dodge: once per dash, the dash recharge is refunded, the super
 * release gauge gains, a DODGE callout shows and the moment lands with a short hit-stop.
 */
export function noteBlockedHit(world: World, u: Unit): void {
  if (u.kind !== 'player' || !u.dodgeArmed || !u.alive || world.status.over) return;
  u.dodgeArmed = false;
  const cfg = world.catalog.battle.player.dodge;
  u.dashCd = Math.max(0, u.dashCd - cfg.dashRefund * u.frame.dashCd);
  chargeRelease(world, u, cfg.releaseCharge);
  world.stats.dodges++;
  world.addFx({ type: 'callout', x: u.x, y: u.y - 26, t: 0, life: 0.7, msg: msg('callout.dodge'), tone: 'accent', size: 14 });
  kick(world, world.catalog.battle.impact.dodge);
}
