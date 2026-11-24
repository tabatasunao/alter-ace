import type { BeamWeapon } from '../../../data/types';
import { firePlayerShot } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** A fast bolt that passes through several units (Beam Rifle). */
export const beam: WeaponBehavior<BeamWeapon> = {
  fire({ world, player, weapon, angle }) {
    firePlayerShot(world, player, weapon, angle, { kind: 'beam', pierce: weapon.pierce, r: weapon.radius });
    return 1;
  },
  burst(ctx) {
    const { world, player, weapon } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, player, weapon, burstAngle(ctx), { kind: 'beam', pierce: weapon.pierce, r: weapon.radius, jitter: 0.1 });
  },
};
