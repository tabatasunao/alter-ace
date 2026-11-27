import type { Catalog } from '../data/catalog';
import { isSoundId } from './sounds';

/** Weapon sounds named in the data that the game does not have. */
export function findMissingSounds(catalog: Catalog): string[] {
  return catalog.weapons
    .filter((w) => w.sound !== undefined && !isSoundId(w.sound))
    .map((w) => `weapon "${w.id}": no sound "${w.sound}"`);
}
