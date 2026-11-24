import { tickStatuses } from '../statuses';
import { activePlayer, type System } from '../System';
import type { World } from '../World';

/** The ace's timers: invulnerability, dash and super release recharge, hit flash, statuses and out-of-combat regeneration. */
export class PlayerStatusSystem implements System {
  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;
    const cfg = world.catalog.battle.player;
    P.iframes -= dt;
    P.dashCd -= dt;
    P.releaseCd -= dt;
    if (P.flash > 0) P.flash -= dt;
    tickStatuses(P, dt);
    if (world.t - P.lastHit > cfg.regenDelay) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * cfg.regenPerSecond * dt);
  }
}
