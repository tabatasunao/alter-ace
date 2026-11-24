import type { ShotUnitWeapon } from '../../../../data/types';
import { leadAngle } from '../../aim';
import { launchUnitShot } from '../unitShot';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

const DEFAULT_RADIUS = 2;

/** One or more projectiles (rifles, beam guns, scatterguns, cannons, artillery), aimed ahead of a moving target. */
export const shot: UnitWeaponBehavior<ShotUnitWeapon> = {
  fire({ world, unit: u, weapon: w, target }) {
    const aim = leadAngle(u.x, u.y, target, w.speed, w.lead);
    const life = (w.range * world.catalog.battle.ai.shotRangeFactor) / w.speed;
    for (let i = 0, n = w.pellets ?? 1; i < n; i++) {
      const a = aim + (world.random.next() - 0.5) * 2 * w.spread;
      launchUnitShot(world, u, w, a, {
        kind: w.projectile,
        speed: w.speed,
        life,
        r: w.radius ?? DEFAULT_RADIUS,
        pierce: w.pierce,
        splash: w.splash,
        splashDmg: w.splashDmg,
      });
    }
  },
};
