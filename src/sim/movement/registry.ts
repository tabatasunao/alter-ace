import type { MovementDef, MovementModelName } from '../../data/types';
import { direct } from './direct';
import type { MovementModel } from './MovementModel';
import { thruster } from './thruster';

type MovementRegistry = { readonly [M in MovementModelName]: MovementModel<Extract<MovementDef, { model: M }>> };

/** Every ace movement model, keyed by battle.json → player.movement.model. */
export const MOVEMENT_MODELS: MovementRegistry = { direct, thruster };

export function movementModelFor<M extends MovementDef>(def: M): MovementModel<M> {
  const model = (MOVEMENT_MODELS as Record<string, MovementModel<never> | undefined>)[def.model];
  if (!model) throw new Error(`No movement model "${def.model}"`);
  return model as unknown as MovementModel<M>;
}
