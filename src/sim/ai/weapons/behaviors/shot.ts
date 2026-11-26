import type { ShotUnitWeapon } from '../../../../data/types';
import { closeLead, closeness, closeSpread, leadAngle } from '../../aim';
import { launchUnitShot } from '../unitShot';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

const DEFAULT_RADIUS = 2;

/**
 * One or more projectiles (rifles, beam guns, scatterguns, cannons, artillery), aimed ahead of a
 * moving target. Close to the ace the aim leads it more and the spread tightens (close-quarters fire).
 */
export const shot: UnitWeaponBehavior<ShotUnitWeapon> = {
  fire({ world, unit: u, weapon: w, target }) {
    const close = world.catalog.battle.ai.closeAim;
    const k = closeness(target, Math.hypot(target.x - u.x, target.y - u.y), close);
    const aim = leadAngle(u.x, u.y, target, w.speed, closeLead(w.lead, k, close));
    const spread = closeSpread(w.spread, k, close);
    const life = (w.range * world.catalog.battle.ai.shotRangeFactor) / w.speed;
    for (let i = 0, n = w.pellets ?? 1; i < n; i++) {
      const a = aim + (world.random.next() - 0.5) * 2 * spread;
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
