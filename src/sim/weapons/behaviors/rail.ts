import type { RailWeapon } from '../../../data/types';
import { lineStrike } from '../../attacks';
import { aceHit } from '../../entities';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** Instant hit on every enemy along the line out to full range (Railgun). */
export const rail: WeaponBehavior<RailWeapon> = {
  fire({ world, player: P, weapon: w, angle }) {
    lineStrike(world, P, angle, { range: w.range, width: w.hitWidth, dmg: w.dmg, lineWidth: w.hitWidth }, aceHit(w), 'ace');
    return 1;
  },
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) lineStrike(world, P, burstAngle(ctx), { range: w.range, width: w.hitWidth, dmg: w.dmg, lineWidth: w.hitWidth }, aceHit(w), 'ace');
  },
};
