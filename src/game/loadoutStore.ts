import type { Loadout } from './loadout';

/** Where the last loadout is remembered. */
export interface LoadoutStore {
  /** The saved value as stored (unvalidated), or null. */
  load(): unknown;
  save(loadout: Loadout): void;
}

/** Browser storage; fails quietly when storage is unavailable (private mode, blocked). */
export class LocalStorageLoadoutStore implements LoadoutStore {
  constructor(private readonly key: string) {}

  load(): unknown {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(loadout: Loadout): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(loadout));
    } catch {
      /* storage unavailable */
    }
  }
}
