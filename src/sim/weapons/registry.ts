import type { WeaponBehaviorName, WeaponDef } from '../../data/types';
import { beam } from './behaviors/beam';
import { breach } from './behaviors/breach';
import { bullet } from './behaviors/bullet';
import { missile } from './behaviors/missile';
import { mortar } from './behaviors/mortar';
import { rail } from './behaviors/rail';
import { saber } from './behaviors/saber';
import type { WeaponBehavior } from './WeaponBehavior';

type BehaviorRegistry = { readonly [B in WeaponBehaviorName]: WeaponBehavior<Extract<WeaponDef, { behavior: B }>> };

/** Every weapon behavior, keyed by the `behavior` field in weapons.json. TypeScript enforces one per name. */
export const WEAPON_BEHAVIORS: BehaviorRegistry = { bullet, beam, rail, missile, breach, mortar, saber };

export function behaviorFor<W extends WeaponDef>(weapon: W): WeaponBehavior<W> {
  const behavior = (WEAPON_BEHAVIORS as Record<string, WeaponBehavior<never> | undefined>)[weapon.behavior];
  if (!behavior) throw new Error(`No weapon behavior "${weapon.behavior}" (weapon "${weapon.id}")`);
  return behavior as unknown as WeaponBehavior<W>;
}
