import type { RailWeapon } from '../../../data/types';
import { lineStrike } from '../../attacks';
import { aceHit, type Player } from '../../entities';
import { speedFraction } from '../../statuses';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** Steady aim: the damage (and line width) multiplier for the ace's current speed. */
export function steadyMul(w: RailWeapon, P: Player): number {
  return w.steady ? w.steady.still + (w.steady.moving - w.steady.still) * speedFraction(P) : 1;
}

/** Instant hit on every enemy along the line out to full range, hardest from a standstill (Railgun). */
export const rail: WeaponBehavior<RailWeapon> = {
  fire({ world, player: P, weapon: w, angle }) {
    const k = steadyMul(w, P);
    lineStrike(world, P, angle, { range: w.range, width: w.hitWidth, dmg: w.dmg * k, lineWidth: w.hitWidth * k }, aceHit(w), 'ace');
    return 1;
  },
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) lineStrike(world, P, burstAngle(ctx), { range: w.range, width: w.hitWidth, dmg: w.dmg, lineWidth: w.hitWidth }, aceHit(w), 'ace');
  },
};
