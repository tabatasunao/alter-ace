import { clamp } from '../../core/math';
import { activePlayer, type System } from '../System';
import type { Player, WeaponSlot } from '../entities';
import { firesAllWeapons, speedFraction, statMul } from '../statuses';
import { pickTargets } from '../targeting/pickTargets';
import { fireWeapon, startReload } from '../weapons/firing';
import type { World } from '../World';

/** A spinning weapon keeps spinning up while its last shot was this recent. */
const SPIN_HOLD = 0.2;

/**
 * Hardpoint timers (every slot keeps reloading in the background, spinning down and cooling), the
 * reticle, and automatic fire: the active weapon, or every weapon hardpoint during super release.
 */
export class PlayerWeaponSystem implements System {
  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;

    for (const s of P.slots) {
      if (s.cd > 0) s.cd -= dt;
      if (s.kind !== 'weapon') continue;
      s.sinceShot += dt;
      if (s.reloadT > 0) {
        s.reloadT -= dt;
        if (s.reloadT <= 0) {
          s.reloadT = 0;
          s.ammo = s.def.mag ?? Infinity;
        }
      }
      spinAndCool(P, s, dt);
    }

    const slot = P.slots[P.active];
    if (slot?.kind !== 'weapon') return;
    world.aim.timer -= dt;
    if (world.aim.timer <= 0) {
      world.aim.timer = world.catalog.reticleInterval;
      P.reticle = pickTargets(world, world.aim.index, slot.def.range, 1)[0] ?? null;
    }
    if (P.reticle && !P.reticle.alive) P.reticle = null;
    if (P.reticle) P.facing = Math.atan2(P.reticle.y - P.y, P.reticle.x - P.x);
    else if (Math.hypot(P.input.x, P.input.y) > 0.15) P.facing = Math.atan2(P.input.y, P.input.x);

    if (firesAllWeapons(P)) {
      for (const s of P.slots) if (s.kind === 'weapon') this.fire(world, P, s);
    } else {
      this.fire(world, P, slot);
    }
  }

  /**
   * Fires the slot if it is loaded and ready (during a dash only weapons with `fireWhileDashing`),
   * then starts its cooldown (and reload, or overheat lockout, when empty).
   */
  private fire(world: World, P: Player, slot: WeaponSlot): void {
    if (slot.ammo <= 0 || slot.reloadT > 0 || slot.cd > 0 || P.lunge) return;
    if (P.dash && !slot.def.fireWhileDashing) return;
    if (!fireWeapon(world, P, slot)) return;
    slot.sinceShot = 0;
    slot.cd = slot.def.interval * P.frame.rateMul * statMul(P, 'fireInterval') * intervalScale(P, slot);
    if (slot.ammo <= 0) startReload(P, slot);
  }
}

/**
 * Spin-up rises while the weapon keeps firing and falls once it stops; heat falls once it has not
 * fired for a moment. During super release a spinning weapon is at full spin and builds no heat.
 */
function spinAndCool(P: Player, s: WeaponSlot, dt: number): void {
  const { spin, heat, mag } = s.def;
  if (spin) s.spin = P.release ? 1 : clamp(s.spin + (s.sinceShot < SPIN_HOLD ? dt / spin.upTime : -dt / spin.downTime), 0, 1);
  if (heat && mag !== null && s.reloadT <= 0) {
    if (P.release) s.ammo = mag;
    else if (s.sinceShot > heat.coolDelay) s.ammo = Math.min(mag, s.ammo + heat.coolPerSecond * dt);
  }
}

/** Movement and spin-up factors on a weapon's time between shots. */
function intervalScale(P: Player, slot: WeaponSlot): number {
  const { movingFireInterval, spin } = slot.def;
  let k = 1;
  if (movingFireInterval !== undefined) k *= 1 + (movingFireInterval - 1) * speedFraction(P);
  if (spin) k /= spin.start + (spin.top - spin.start) * slot.spin;
  return k;
}
