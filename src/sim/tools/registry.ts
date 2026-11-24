import type { ToolDef, ToolEffectName } from '../../data/types';
import { decoy } from './effects/decoy';
import { emp } from './effects/emp';
import { overboost } from './effects/overboost';
import { repair } from './effects/repair';
import type { ToolEffect } from './ToolEffect';

type EffectRegistry = { readonly [E in ToolEffectName]: ToolEffect<Extract<ToolDef, { effect: E }>> };

/** Every tool effect, keyed by the `effect` field in tools.json. TypeScript enforces one per name. */
export const TOOL_EFFECTS: EffectRegistry = { repair, emp, decoy, overboost };

export function effectFor<T extends ToolDef>(tool: T): ToolEffect<T> {
  const effect = (TOOL_EFFECTS as Record<string, ToolEffect<never> | undefined>)[tool.effect];
  if (!effect) throw new Error(`No tool effect "${tool.effect}" (tool "${tool.id}")`);
  return effect as unknown as ToolEffect<T>;
}
