import { TAU } from '../../../../core/math';
import type { MissileUnitWeapon } from '../../../../data/types';
import { fanOffset } from '../../../attacks';
import { preferredTarget } from '../../targetSelection';
import { launchUnitShot } from '../unitShot';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

/**
 * A fanned salvo of homing missiles, all locked on the unit's target (Missile rack). With
 * `launchAngle`/`homingDelay` they first fly away (backwards) before homing. With `weave`,
 * each missile also swings around its pursuit line from its own phase: a wide fan of weaving
 * trails (Micro-missile swarm) for the price of one sine per missile per step. With `terminal`,
 * each missile makes one hard turn at its target when it comes within range, then flies straight on:
 * a target that keeps moving slips past.
 */
export const missile: UnitWeaponBehavior<MissileUnitWeapon> = {
  fire({ world, unit: u, weapon: w, target }) {
    const base = Math.atan2(target.y - u.y, target.x - u.x);
    const shared = {
      turnRate: w.turnRate,
      acceleration: w.acceleration,
      retargetRadius: w.retargetRadius,
      ...(w.homingDelay ? { armAt: w.life - w.homingDelay } : {}),
      ...(w.terminal ? { terminal: w.terminal } : {}),
      prefer: preferredTarget(world, u),
    };
    for (let i = 0; i < w.salvo; i++) {
      const a = base + (w.launchAngle ?? 0) + fanOffset(i, w.salvo, w.fanAngle);
      // Each missile gets its own copy: the weave phase and the terminal turn are per missile.
      const homing = w.weave ? { ...shared, weave: { ...w.weave, phase: world.random.next() * TAU } } : { ...shared };
      launchUnitShot(world, u, w, a, {
        kind: 'missile',
        speed: w.launchSpeed,
        maxSpeed: w.speed,
        life: w.life,
        r: w.radius,
        splash: w.splash,
        splashDmg: w.splashDmg,
        homing,
        target,
      });
    }
  },
};
