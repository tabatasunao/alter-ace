import type { Catalog } from '../data/catalog';
import { isWeapon } from '../data/types';

/** What the player picks in the hangar. */
export interface Loadout {
  frame: string;
  slots: string[];
  aim: string;
  enemies: number;
}

export type LoadoutCheck = { ok: true } | { ok: false; message: string };

/**
 * Coerces anything (e.g. stale saved data) into a loadout the current catalog accepts: unknown
 * frames, aim modes and sizes fall back to the defaults; duplicate and non-string slots are dropped;
 * a slot naming a weapon or tool that no longer exists is refilled from the default loadout.
 */
export function sanitizeLoadout(raw: unknown, catalog: Catalog): Loadout {
  const def = catalog.loadout.defaultLoadout;
  const out: Loadout = { frame: def.frame, slots: [...def.slots], aim: def.aim, enemies: def.enemies };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof Loadout, unknown>>;
  if (typeof r.frame === 'string' && catalog.frames.some((f) => f.id === r.frame)) out.frame = r.frame;
  if (Array.isArray(r.slots)) {
    const valid = [...new Set(r.slots.filter((id): id is string => typeof id === 'string' && catalog.hasArmament(id)))];
    // A weapon or tool that no longer exists gives its hardpoint to the default loadout's next unused item.
    const retired = r.slots.filter((id) => typeof id === 'string' && !catalog.hasArmament(id)).length;
    const fill = def.slots.filter((id) => !valid.includes(id)).slice(0, retired);
    out.slots = [...valid, ...fill].slice(0, catalog.loadout.slots);
  }
  if (typeof r.aim === 'string' && catalog.aimModes.some((m) => m.id === r.aim)) out.aim = r.aim;
  if (typeof r.enemies === 'number' && Number.isFinite(r.enemies)) out.enemies = snapEnemyCount(r.enemies, catalog);
  return out;
}

function snapEnemyCount(n: number, catalog: Catalog): number {
  const { min, max, step } = catalog.loadout.enemyCount;
  const snapped = Math.round(n / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Hangar rules: every hardpoint filled, at least one weapon. */
function checkLoadout(loadout: Loadout, catalog: Catalog): LoadoutCheck {
  const slots = catalog.loadout.slots;
  if (loadout.slots.length < slots) {
    return { ok: false, message: `Fill all ${slots} hardpoints (${slots - loadout.slots.length} empty).` };
  }
  if (!loadout.slots.some((id) => isWeapon(catalog.armament(id)))) {
    return { ok: false, message: 'Pick at least one weapon. Tools alone can’t shoot.' };
  }
  return { ok: true };
}

export type ToggleResult = 'added' | 'removed' | 'full';

/** The hangar's editable selection. Pure model: no DOM, so it is unit-tested directly. */
export class LoadoutEditor {
  private current: Loadout;

  constructor(
    private readonly catalog: Catalog,
    initial: Loadout,
  ) {
    this.current = sanitizeLoadout(initial, catalog);
  }

  get value(): Loadout {
    return { ...this.current, slots: [...this.current.slots] };
  }

  get slotCount(): number {
    return this.catalog.loadout.slots;
  }

  setFrame(id: string): void {
    this.catalog.frame(id);
    this.current.frame = id;
  }

  setAim(id: string): void {
    this.catalog.aimModeIndex(id);
    this.current.aim = id;
  }

  setEnemies(n: number): void {
    this.current.enemies = snapEnemyCount(n, this.catalog);
  }

  /** Adds the item to the next free hardpoint, or removes it if equipped. */
  toggle(id: string): ToggleResult {
    const i = this.current.slots.indexOf(id);
    if (i >= 0) {
      this.current.slots.splice(i, 1);
      return 'removed';
    }
    if (this.current.slots.length >= this.slotCount) return 'full';
    this.catalog.armament(id);
    this.current.slots.push(id);
    return 'added';
  }

  remove(id: string): void {
    this.current.slots = this.current.slots.filter((s) => s !== id);
  }

  check(): LoadoutCheck {
    return checkLoadout(this.current, this.catalog);
  }
}
