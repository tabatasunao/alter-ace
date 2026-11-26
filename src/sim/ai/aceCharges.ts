import type { Soldier } from '../entities';
import type { World } from '../World';

/** Who is charging an attack at the ace, and when the last of those attacks fires. */
export interface AceChargeLedger {
  holders: Soldier[];
  /** Battle time the latest charge at the ace is due to fire. */
  lastFireAt: number;
}

/**
 * Asks for a turn to charge an attack of `chargeTime` at the ace (battle.json → ai.aceCharges).
 * At most `max` units hold a turn at once; a holder that died, was stunned or finished gives it
 * back. Returns the extra charge time that keeps this attack `gap` after the one before it, or
 * null when every turn is taken.
 */
export function claimAceCharge(world: World, unit: Soldier, chargeTime: number): number | null {
  const cfg = world.catalog.battle.ai.aceCharges;
  const ledger = world.aceCharges;
  ledger.holders = ledger.holders.filter((h) => h.alive && h.action?.sightLine?.target.kind === 'player');
  if (ledger.holders.length >= cfg.max) return null;
  ledger.holders.push(unit);
  const due = world.t + chargeTime;
  const fireAt = Math.max(due, ledger.lastFireAt + cfg.gap);
  ledger.lastFireAt = fireAt;
  return fireAt - due;
}
