import type { Player, WeaponSlot } from '../entities';
import { pickTargets } from '../targeting/pickTargets';
import type { World } from '../World';
import { behaviorFor } from './registry';

/** Fires the slot's weapon at the aim mode's pick. Returns false (and spends nothing) with no target in range. */
export function fireWeapon(world: World, P: Player, slot: WeaponSlot): boolean {
  const weapon = slot.def;
  const behavior = behaviorFor(weapon);
  const targets = pickTargets(world, world.aim.index, weapon.range, behavior.targetsWanted?.(weapon) ?? 1);
  if (targets.length === 0) return false;
  const target = targets[0]!;
  const angle = Math.atan2(target.y - P.y, target.x - P.x);
  P.reticle = target;
  P.facing = angle;
  slot.ammo -= behavior.fire({ world, player: P, weapon, targets, angle, ammo: slot.ammo });
  return true;
}

/**
 * Super release's opening burst: every weapon hardpoint launches `seconds` worth of its fire at once
 * (rounds per shot ÷ the ace's time between shots), sprayed in random directions around the ace, or
 * within its `burstArc` in front for forward-only weapons. Works with no enemy near; uses no ammo.
 */
export function burstAll(world: World, P: Player, seconds: number): void {
  for (const slot of P.slots) {
    if (slot.kind !== 'weapon') continue;
    const behavior = behaviorFor(slot.def);
    if (!behavior.burst) continue;
    const perSecond = (behavior.roundsPerShot?.(slot.def) ?? 1) / (slot.def.interval * P.frame.rateMul);
    const count = Math.max(1, Math.round(seconds * perSecond));
    const arc = ((slot.def.burstArc ?? 360) * Math.PI) / 180;
    behavior.burst({ world, player: P, weapon: slot.def, count, facing: P.facing, arc });
  }
}

/** Starts a magazine reload unless one is running or the weapon has unlimited ammo. */
export function startReload(P: Player, slot: WeaponSlot): void {
  if (slot.def.mag === null || slot.reloadT > 0) return;
  slot.reloadTotal = slot.reloadT = slot.def.reload * P.frame.reloadMul;
}
