import type { UnitWeaponBehaviorName, UnitWeaponDef } from '../../../data/types';
import { lance } from './behaviors/lance';
import { missile } from './behaviors/missile';
import { saber } from './behaviors/saber';
import { shot } from './behaviors/shot';
import type { UnitWeaponBehavior } from './UnitWeaponBehavior';

type UnitBehaviorRegistry = {
  readonly [B in UnitWeaponBehaviorName]: UnitWeaponBehavior<Extract<UnitWeaponDef, { behavior: B }>>;
};

/** Every AI unit weapon behavior, keyed by the `behavior` field in unitWeapons.json. TypeScript enforces one per name. */
export const UNIT_WEAPON_BEHAVIORS: UnitBehaviorRegistry = { shot, missile, lance, saber };

export function unitBehaviorFor<W extends UnitWeaponDef>(weapon: W): UnitWeaponBehavior<W> {
  const behavior = (UNIT_WEAPON_BEHAVIORS as Record<string, UnitWeaponBehavior<never> | undefined>)[weapon.behavior];
  if (!behavior) throw new Error(`No unit weapon behavior "${weapon.behavior}" (unit weapon "${weapon.id}")`);
  return behavior as unknown as UnitWeaponBehavior<W>;
}
