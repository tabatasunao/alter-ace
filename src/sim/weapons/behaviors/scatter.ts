import type { ScatterWeapon } from '../../../data/types';
import { firePlayerShot, spreadAngle } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** A fan of pellets with varied speeds; one round per blast (Scatter Cannon). */
export const scatter: WeaponBehavior<ScatterWeapon> = {
  roundsPerShot: (w) => w.pellets,
  burst(ctx) {
    const { world, player, weapon } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, player, weapon, burstAngle(ctx), { jitter: Math.max(weapon.speedJitter, 0.35) });
  },
  fire({ world, player, weapon, angle }) {
    for (let i = 0; i < weapon.pellets; i++) {
      firePlayerShot(world, player, weapon, spreadAngle(world, angle, weapon.spread), { jitter: weapon.speedJitter });
    }
    return 1;
  },
};
