import type { ShotgunWeapon } from '../../../data/types';
import { kick } from '../../impact';
import { firePlayerShot, spreadAngle } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/**
 * A spread of pellets every shot; each pellet that hits an enemy ALTER knocks it back (Shotgun).
 * Every shot jolts the ace back a short, fixed distance (then a slight slide), with a screen shake.
 */
export const shotgun: WeaponBehavior<ShotgunWeapon> = {
  roundsPerShot: (w) => w.pellets,
  fire({ world, player: P, weapon: w, angle }) {
    for (let i = 0; i < w.pellets; i++) firePlayerShot(world, P, w, spreadAngle(world, angle, w.spread), { jitter: w.speedJitter, knock: w.knock });
    const speed = w.jolt.distance / w.jolt.time;
    P.jolt = { remaining: w.jolt.time, vx: -Math.cos(angle) * speed, vy: -Math.sin(angle) * speed };
    P.vx -= Math.cos(angle) * w.jolt.carry;
    P.vy -= Math.sin(angle) * w.jolt.carry;
    kick(world, world.catalog.battle.impact.shotgun);
    return 1;
  },
  // Pellets everywhere, at widely varied speeds.
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, P, w, burstAngle(ctx), { jitter: Math.max(w.speedJitter, 0.35), knock: w.knock });
  },
};
