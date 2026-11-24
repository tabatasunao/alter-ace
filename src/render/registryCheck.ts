import type { Catalog } from '../data/catalog';
import { UNIT_PAINTERS } from './painters/unitPainters';

/** Unit shapes used in the data that have no painter. */
export function findMissingPainters(catalog: Catalog): string[] {
  return catalog.classes
    .filter((c) => !(c.shape in UNIT_PAINTERS))
    .map((c) => `unit class "${c.id}": no painter for shape "${c.shape}"`);
}
