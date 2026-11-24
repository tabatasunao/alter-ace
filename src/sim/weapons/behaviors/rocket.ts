import type { RocketWeapon } from '../../../data/types';
import { firePlayerShot } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** A slow shell that explodes on impact or at the end of its range (Bazooka). */
export const rocket: WeaponBehavior<RocketWeapon> = {
  fire({ world, player, weapon, angle }) {
    firePlayerShot(world, player, weapon, angle, { kind: 'shell', r: weapon.radius, splash: weapon.splash, splashDmg: weapon.splashDmg });
    return 1;
  },
  burst(ctx) {
    const { world, player, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, player, w, burstAngle(ctx), { kind: 'shell', r: w.radius, splash: w.splash, splashDmg: w.splashDmg, jitter: 0.3 });
  },
};
