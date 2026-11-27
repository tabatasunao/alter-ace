import type { Catalog } from '../data/catalog';
import { UNIT_PAINTERS } from './painters/unitPainters';

/** Unit shapes used in the data that have no painter. */
export function findMissingPainters(catalog: Catalog): string[] {
  return catalog.classes.flatMap((c) =>
    [c.shape, c.enemyShape]
      .filter((shape): shape is string => shape !== undefined && !(shape in UNIT_PAINTERS))
      .map((shape) => `unit class "${c.id}": no painter for shape "${shape}"`),
  );
}
