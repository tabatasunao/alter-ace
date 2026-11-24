import type { Catalog } from '../data/catalog';
import { UNIT_WEAPON_BEHAVIORS } from './ai/weapons/registry';
import { MOVEMENT_MODELS } from './movement/registry';
import { AIM_STRATEGIES } from './targeting/aimStrategies';
import { TOOL_EFFECTS } from './tools/registry';
import { WEAPON_BEHAVIORS } from './weapons/registry';

/** Every behavior/effect/strategy name used in the data that has no implementation in code. */
export function findMissingSimImplementations(catalog: Catalog): string[] {
  const missing: string[] = [];
  for (const w of catalog.weapons) {
    if (!(w.behavior in WEAPON_BEHAVIORS)) missing.push(`weapon "${w.id}": no behavior "${w.behavior}"`);
  }
  for (const t of catalog.tools) {
    if (!(t.effect in TOOL_EFFECTS)) missing.push(`tool "${t.id}": no effect "${t.effect}"`);
  }
  for (const m of catalog.aimModes) {
    if (!(m.strategy in AIM_STRATEGIES)) missing.push(`aim mode "${m.id}": no strategy "${m.strategy}"`);
  }
  for (const w of catalog.unitWeapons) {
    if (!(w.behavior in UNIT_WEAPON_BEHAVIORS)) missing.push(`unit weapon "${w.id}": no behavior "${w.behavior}"`);
  }
  const movement = catalog.battle.player.movement.model;
  if (!(movement in MOVEMENT_MODELS)) missing.push(`player movement: no model "${movement}"`);
  return missing;
}
