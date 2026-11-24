import { activePlayer, type System } from '../System';
import type { Player, WeaponSlot } from '../entities';
import { firesAllWeapons, statMul } from '../statuses';
import { pickTargets } from '../targeting/pickTargets';
import { fireWeapon, startReload } from '../weapons/firing';
import type { World } from '../World';

/**
 * Hardpoint timers (every slot keeps reloading in the background), the reticle, and automatic
 * fire: the active weapon, or every weapon hardpoint during super release.
 */
export class PlayerWeaponSystem implements System {
  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;

    for (const s of P.slots) {
      if (s.cd > 0) s.cd -= dt;
      if (s.kind === 'weapon' && s.reloadT > 0) {
        s.reloadT -= dt;
        if (s.reloadT <= 0) {
          s.reloadT = 0;
          s.ammo = s.def.mag ?? Infinity;
        }
      }
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

  /** Fires the slot if it is loaded and ready, then starts its cooldown (and reload when empty). */
  private fire(world: World, P: Player, slot: WeaponSlot): void {
    if (slot.ammo <= 0 || slot.reloadT > 0 || slot.cd > 0 || P.lunge || P.dash) return;
    if (!fireWeapon(world, P, slot)) return;
    slot.cd = slot.def.interval * P.frame.rateMul * statMul(P, 'fireInterval');
    if (slot.ammo <= 0) startReload(P, slot);
  }
}
