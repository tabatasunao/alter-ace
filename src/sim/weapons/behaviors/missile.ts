import type { MissileWeapon } from '../../../data/types';
import { fanOffset } from '../../attacks';
import { firePlayerShot } from '../playerShot';
import { pickTargets } from '../../targeting/pickTargets';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** The Missile Pod's homing: a launch phase, then pursuit; a missile whose target dies picks another at random nearby. */
function homingOf(w: MissileWeapon) {
  return { turnRate: w.turnRate, acceleration: w.acceleration, retargetRadius: w.retargetRadius, armAt: w.life - w.homingDelay, spread: true };
}

/**
 * A fanned salvo of homing missiles, each assigned the next-ranked target (Missile Pod). They
 * launch at `launchAngle` to the target (straight back, for the Missile Pod), fly that way for
 * `homingDelay`, then turn and home in.
 */
export const missile: WeaponBehavior<MissileWeapon> = {
  targetsWanted: (w) => w.salvo,
  roundsPerShot: (w) => w.salvo,
  // A wild spray: missiles fly out every which way at varied speeds, then curve around, each onto a
  // different enemy in range (ranked by the aim mode) where there are enough to go round.
  burst(ctx) {
    const { world, player, weapon: w } = ctx;
    const homing = homingOf(w);
    const targets = pickTargets(world, world.aim.index, w.range, ctx.count);
    for (let i = 0; i < ctx.count; i++) {
      firePlayerShot(world, player, w, burstAngle(ctx), {
        kind: 'missile',
        homing,
        target: targets.length ? targets[i % targets.length]! : undefined,
        speed: w.launchSpeed,
        jitter: 0.5,
        life: w.life,
        r: w.radius,
        splash: w.splash,
        splashDmg: w.splashDmg,
      });
    }
  },
  fire({ world, player, weapon: w, targets, angle, ammo }) {
    const n = Math.min(w.salvo, ammo);
    const homing = homingOf(w);
    for (let i = 0; i < n; i++) {
      const a = angle + w.launchAngle + fanOffset(i, n, w.fanAngle);
      firePlayerShot(world, player, w, a, {
        kind: 'missile',
        homing,
        target: targets[i % targets.length]!,
        speed: w.launchSpeed,
        life: w.life,
        r: w.radius,
        splash: w.splash,
        splashDmg: w.splashDmg,
      });
    }
    return n;
  },
};
