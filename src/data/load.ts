import { Catalog } from './catalog';
import type { GameData } from './types';
import { validateGameData } from './validate';

/** One JSON file per key of GameData, in public/data/<name>.json. */
export const DATA_FILES = [
  'frames',
  'damage',
  'weapons',
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

/** Seconds to wait before each retry of a failed data request (three retries). */
export const RETRY_DELAYS = [0.5, 1, 2] as const;

export interface LoadOptions {
  /** Replaces the global `fetch` (tests). */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Waits `seconds` before a retry (tests replace it to skip the delay). */
  wait?: (seconds: number) => Promise<void>;
}

const sleep = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));

/** Server errors, request timeouts and rate limiting can pass; a missing file (404) will not. */
function isTransient(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Fetches `url`, retrying network errors and transient HTTP errors after each delay in
 * RETRY_DELAYS. Throws on a non-transient error or when every attempt has failed.
 */
export async function fetchWithRetry(url: string, options: LoadOptions = {}): Promise<Response> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const wait = options.wait ?? sleep;
  for (let attempt = 0; ; attempt++) {
    const last = attempt === RETRY_DELAYS.length;
    let res: Response;
    try {
      res = await fetchFn(url, { cache: 'no-store' });
    } catch (err) {
      if (last) throw new Error(`Failed to load ${url} (${(err as Error).message})`);
      await wait(RETRY_DELAYS[attempt]!);
      continue;
    }
    if (res.ok) return res;
    if (last || !isTransient(res.status)) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
    await wait(RETRY_DELAYS[attempt]!);
  }
}

/** Fetches all tuning files at runtime, so a built game can be re-tuned without a rebuild. */
export async function loadCatalog(baseUrl: string = import.meta.env.BASE_URL, options: LoadOptions = {}): Promise<Catalog> {
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const url = `${baseUrl}data/${name}.json`;
      const res = await fetchWithRetry(url, options);
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
