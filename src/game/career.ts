import type { LoadoutData } from '../data/types';

/** What the browser remembers across sorties: best score per enemy army size, and kills per weapon. */
export interface Career {
  /** Best score, keyed by the enemy army size. */
  best: Record<string, number>;
  /** Kills with each weapon over every sortie, keyed by weapon id. */
  kills: Record<string, number>;
}

export type Medal = LoadoutData['medals'][number];

/** Where the career is remembered. */
export interface CareerStore {
  /** The saved value as stored (unvalidated), or null. */
  load(): unknown;
  save(career: Career): void;
}

/** Browser storage; fails quietly when storage is unavailable (private mode, blocked). */
export class LocalStorageCareerStore implements CareerStore {
  constructor(private readonly key: string) {}

  load(): unknown {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(career: Career): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(career));
    } catch {
      /* storage unavailable */
    }
  }
}

/** Only finite, non-negative numbers survive from a stored record. */
function numbers(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) as Record<string, number>;
}

/** A clean career from whatever storage held (an empty one when it held nothing usable). */
export function sanitizeCareer(raw: unknown): Career {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Career, unknown>>;
  return { best: numbers(r.best), kills: numbers(r.kills) };
}

/** The highest medal reached with this many kills, or null. */
export function medalFor(kills: number, medals: readonly Medal[]): Medal | null {
  let reached: Medal | null = null;
  for (const m of medals) if (kills >= m.kills) reached = m;
  return reached;
}

/** The next medal to earn, or null when every medal is earned. */
export function nextMedal(kills: number, medals: readonly Medal[]): Medal | null {
  return medals.find((m) => kills < m.kills) ?? null;
}

/** What one sortie added to the career. */
export interface SortieRecord {
  career: Career;
  /** The best score for this army size before the sortie, or null if there was none. */
  previousBest: number | null;
  newBest: boolean;
  /** Medals earned in this sortie, one per weapon (its highest new one). */
  medals: { weapon: string; medal: Medal }[];
}

/**
 * Adds a sortie to the career: weapon kills always count; a score (won sorties only) may set a
 * new best for its army size. Returns a new career; the old one is not changed.
 */
export function recordSortie(
  career: Career,
  sortie: { enemies: number; killsBy: Readonly<Record<string, number>>; score: number | null },
  medals: readonly Medal[],
): SortieRecord {
  const kills = { ...career.kills };
  const earned: SortieRecord['medals'] = [];
  for (const [weapon, n] of Object.entries(sortie.killsBy)) {
    if (n <= 0) continue;
    const before = kills[weapon] ?? 0;
    kills[weapon] = before + n;
    const now = medalFor(before + n, medals);
    if (now && now !== medalFor(before, medals)) earned.push({ weapon, medal: now });
  }
  const key = String(sortie.enemies);
  const previousBest = career.best[key] ?? null;
  const newBest = sortie.score !== null && (previousBest === null || sortie.score > previousBest);
  const best = newBest ? { ...career.best, [key]: sortie.score! } : { ...career.best };
  return { career: { best, kills }, previousBest, newBest, medals: earned };
}
