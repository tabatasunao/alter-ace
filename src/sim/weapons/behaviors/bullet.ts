import type { BulletWeapon } from '../../../data/types';
import { firePlayerShot, spreadAngle } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** ± fraction of speed variation per round in a super release burst. */
const BURST_JITTER = 0.35;

/** One round per shot with a little spread, optionally piercing (fixture weapons only). */
export const bullet: WeaponBehavior<BulletWeapon> = {
  fire({ world, player, weapon, angle }) {
    firePlayerShot(world, player, weapon, spreadAngle(world, angle, weapon.spread), { pierce: weapon.pierce });
    return 1;
  },
  burst(ctx) {
    const { world, player, weapon } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, player, weapon, burstAngle(ctx), { pierce: weapon.pierce, jitter: BURST_JITTER });
  },
};
