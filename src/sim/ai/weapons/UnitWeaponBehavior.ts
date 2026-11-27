import type { UnitWeaponDef } from '../../../data/types';
import type { Soldier, Unit } from '../../entities';
import type { World } from '../../World';

export interface UnitFireContext<W extends UnitWeaponDef = UnitWeaponDef> {
  readonly world: World;
  readonly unit: Soldier;
  readonly weapon: W;
  /** The unit's current target, within the weapon's range. */
  readonly target: Unit;
}

/**
 * How one kind of AI unit weapon fires. The caller (SoldierAISystem) picks the target,
 * checks range and handles the cooldown, so a behavior only creates shots or starts a
 * UnitAction on the unit (a charge, a lunge) for UnitActionSystem to finish.
 *
 * To add one: add its def type to UnitWeaponDef (src/data/types.ts),
 * implement this interface in behaviors/, and register it in registry.ts.
 */
export interface UnitWeaponBehavior<W extends UnitWeaponDef = UnitWeaponDef> {
  /** Fires; returns false to hold fire (the caller retries after `ai.aceCharges.retry`). */
  fire(ctx: UnitFireContext<W>): boolean | void;
  /** How far away a target may be for `fire` to be called (default the weapon's `range`). */
  reach?(weapon: W): number;
}
