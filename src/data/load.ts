import { Catalog } from './catalog';
import type { GameData } from './types';
import { validateGameData } from './validate';

/** One JSON file per key of GameData, in public/data/<name>.json. */
export const DATA_FILES = [
  'frames',
  'damage',
  'weapons',
  'tools',
  'aimModes',
  'unitWeapons',
  'units',
  'armies',
  'loadout',
  'battle',
] as const satisfies readonly (keyof GameData)[];

export type DataFileName = (typeof DATA_FILES)[number];

/** Turns parsed JSON into a Catalog, throwing with every problem found. */
export function buildCatalog(raw: Record<DataFileName, unknown>): Catalog {
  const data = raw as unknown as GameData;
  const errors = validateGameData(data);
  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join('\n- ')}`);
  }
  return new Catalog(data);
}

/** Fetches all tuning files at runtime, so a built game can be re-tuned without a rebuild. */
export async function loadCatalog(baseUrl: string = import.meta.env.BASE_URL): Promise<Catalog> {
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const url = `${baseUrl}data/${name}.json`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
      try {
        return [name, await res.json()] as const;
      } catch (err) {
        throw new Error(`data/${name}.json is not valid JSON: ${(err as Error).message}`);
      }
    }),
  );
  return buildCatalog(Object.fromEntries(entries) as Record<DataFileName, unknown>);
}

/** Dev only: calls `onChange` whenever a file in public/data is saved. */
export function onDataFileChanged(onChange: (file: string) => void): void {
  if (!import.meta.hot) return;
  import.meta.hot.on('alter:data-changed', (payload: { file: string }) => onChange(payload.file));
}
