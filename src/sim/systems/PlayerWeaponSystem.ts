import { activePlayer, type System } from '../System';
import type { Player, WeaponSlot } from '../entities';
import { firesAllWeapons, speedFraction, statMul } from '../statuses';
import { pickTargets } from '../targeting/pickTargets';
import { fireWeapon, startReload } from '../weapons/firing';
import type { World } from '../World';

/**
 * Hardpoint timers (every slot keeps reloading in the background), the reticle, and automatic
 * fire: the active weapon, or every weapon hardpoint during Full Arms.
 */
export class PlayerWeaponSystem implements System {
  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;

    for (const s of P.slots) {
      if (s.cd > 0) s.cd -= dt;
      s.sinceShot += dt;
      if (s.reloadT > 0) {
        s.reloadT -= dt;
        if (s.reloadT <= 0) {
          s.reloadT = 0;
          s.ammo = s.def.mag ?? Infinity;
        }
      }
    }

    const slot = P.slots[P.active];
    if (!slot) return;
    world.aim.timer -= dt;
    if (world.aim.timer <= 0) {
      world.aim.timer = world.catalog.reticleInterval;
      P.reticle = pickTargets(world, world.aim.index, slot.def.range, 1)[0] ?? null;
    }
    if (P.reticle && !P.reticle.alive) P.reticle = null;
    if (P.reticle) P.facing = Math.atan2(P.reticle.y - P.y, P.reticle.x - P.x);
    else if (Math.hypot(P.input.x, P.input.y) > 0.15) P.facing = Math.atan2(P.input.y, P.input.x);

    if (firesAllWeapons(P)) {
      for (const s of P.slots) this.fire(world, P, s);
    } else {
      this.fire(world, P, slot);
    }
  }

  /**
   * Fires the slot if it is loaded and ready (during a dash only weapons with `fireWhileDashing`),
   * then starts its cooldown (and reload when empty).
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

/** The weapon's own factors on its time between shots: movement, and Full Arms. */
function intervalScale(P: Player, slot: WeaponSlot): number {
  const m = slot.def.movingFireInterval;
  const moving = m === undefined ? 1 : 1 + (m - 1) * speedFraction(P);
  return moving * (P.release ? (slot.def.fullArmsFireInterval ?? 1) : 1);
}
