import type { Player } from '../entities';
import type { World } from '../World';
import { effectFor } from './registry';

/** Uses the tool in slot `index` if it has recharged; otherwise reports a denied press. */
export function useTool(world: World, P: Player, index: number): boolean {
  const slot = P.slots[index];
  if (!slot || slot.kind !== 'tool') return false;
  if (slot.cd > 0) {
    world.events.emit('slotDenied', { slot: index });
    return false;
  }
  effectFor(slot.def).use({ world, player: P, tool: slot.def });
  slot.cdTotal = slot.cd = slot.def.cooldown * P.frame.toolMul;
  return true;
}
