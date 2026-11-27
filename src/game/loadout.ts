import { clamp } from '../core/math';
import type { Catalog } from '../data/catalog';
import { FRAME_STATS, type FrameBuild, type FrameStat } from '../data/types';
import { msg, type Message } from '../sim/messages';
import type { BattleSetup } from '../sim/scenarios';

/** What the player picks in the hangar. */
export interface Loadout {
  /** The player's name for their ALTER. */
  name: string;
  /** Points on each frame stat. */
  build: FrameBuild;
  /** One entry per hardpoint, in key order; null is an empty hardpoint. */
  slots: (string | null)[];
  aim: string;
  enemies: number;
}

export type LoadoutCheck = { ok: true } | { ok: false; message: Message };

/**
 * Coerces anything (e.g. stale saved data) into a loadout the current catalog accepts: unknown
 * builds, aim modes and sizes fall back to the defaults; duplicate and non-string slots become
 * empty hardpoints; a slot naming a weapon that no longer exists is refilled, in place,
 * from the default loadout. The slot list always has one entry per hardpoint.
 */
export function sanitizeLoadout(raw: unknown, catalog: Catalog): Loadout {
  const def = catalog.loadout.defaultLoadout;
  const out: Loadout = { name: def.name, build: { ...def.build }, slots: [...def.slots], aim: def.aim, enemies: def.enemies };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof Loadout | 'frame', unknown>>;
  out.name = sanitizeName(r.name, catalog);
  out.build = sanitizeBuild(r.build, r.frame, catalog);
  if (Array.isArray(r.slots)) {
    const raw = r.slots.slice(0, catalog.loadout.slots) as unknown[];
    const kept = raw.map((id, i) =>
      typeof id === 'string' && catalog.hasWeapon(id) && raw.indexOf(id) === i ? id : null,
    );
    // A weapon that no longer exists gives its hardpoint to the default loadout's next unused weapon.
    const spare = def.slots.filter((id) => !kept.includes(id));
    out.slots = Array.from({ length: catalog.loadout.slots }, (_, i) => {
      const id = raw[i];
      if (kept[i] !== null && kept[i] !== undefined) return kept[i]!;
      return typeof id === 'string' && !catalog.hasWeapon(id) ? (spare.shift() ?? null) : null;
    });
  }
  if (typeof r.aim === 'string' && catalog.aimModes.some((m) => m.id === r.aim)) out.aim = r.aim;
  if (typeof r.enemies === 'number' && Number.isFinite(r.enemies)) out.enemies = snapEnemyCount(r.enemies, catalog);
  return out;
}

/**
 * A clean frame build: whole points from 0 to `maxPerStat` on each stat, no more than the frame's
 * points in all (the stats with the most give points back first). A saved frame id from before
 * builds (`legacyFrame`) becomes the preset of that name.
 */
export function sanitizeBuild(raw: unknown, legacyFrame: unknown, catalog: Catalog): FrameBuild {
  const fb = catalog.frameBuild;
  const preset = typeof legacyFrame === 'string' ? fb.presets.find((p) => p.name.toLowerCase() === legacyFrame.toLowerCase())?.build : undefined;
  const src = (raw && typeof raw === 'object' ? raw : (preset ?? catalog.loadout.defaultLoadout.build)) as Record<string, unknown>;
  const out = {} as FrameBuild;
  for (const s of FRAME_STATS) {
    const v = src[s];
    out[s] = typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 0, fb.maxPerStat) : 0;
  }
  let over = pointsSpent(out) - fb.points;
  while (over > 0) {
    const top = FRAME_STATS.reduce((a, b) => (out[b] > out[a] ? b : a));
    out[top]--;
    over--;
  }
  return out;
}

/** Longest ALTER name, in characters. */
export const NAME_MAX = 16;

/** A clean ALTER name: control characters removed, spaces collapsed, at most NAME_MAX characters; empty becomes the default name. */
export function sanitizeName(raw: unknown, catalog: Catalog): string {
  if (typeof raw !== 'string') return catalog.loadout.defaultLoadout.name;
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return [...clean].slice(0, NAME_MAX).join('').trim() || catalog.loadout.defaultLoadout.name;
}

/** Points a build spends. */
export function pointsSpent(build: FrameBuild): number {
  return FRAME_STATS.reduce((n, s) => n + build[s], 0);
}

function snapEnemyCount(n: number, catalog: Catalog): number {
  const { min, max, step } = catalog.loadout.enemyCount;
  const snapped = Math.round(n / step) * step;
  return clamp(snapped, min, max);
}

/** Hangar rule: every hardpoint filled. */
function checkLoadout(loadout: Loadout, catalog: Catalog): LoadoutCheck {
  const slots = catalog.loadout.slots;
  const filled = filledSlots(loadout);
  if (filled.length < slots) {
    return { ok: false, message: msg('loadout.fill', { n: slots, empty: slots - filled.length }) };
  }
  return { ok: true };
}

/** The equipped items, in hardpoint order, without the empty hardpoints. */
export function filledSlots(loadout: Loadout): string[] {
  return loadout.slots.filter((id): id is string => id !== null);
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
    return { ...this.current, build: { ...this.current.build }, slots: [...this.current.slots] };
  }

  /** Frame points not yet spent. */
  get pointsLeft(): number {
    return this.catalog.frameBuild.points - pointsSpent(this.current.build);
  }

  get slotCount(): number {
    return this.catalog.loadout.slots;
  }

  /** Adds (or with a negative delta, removes) points on a stat, within its cap and the points left. */
  adjust(stat: FrameStat, delta: number): boolean {
    const cur = this.current.build[stat];
    const next = Math.min(clamp(cur + delta, 0, this.catalog.frameBuild.maxPerStat), cur + this.pointsLeft);
    if (next === cur) return false;
    this.current.build[stat] = next;
    return true;
  }

  /** Sets a stat's points, as far as its cap and the points left allow. */
  setPoints(stat: FrameStat, points: number): boolean {
    return this.adjust(stat, points - this.current.build[stat]);
  }

  /** Renames the ALTER (cleaned; empty falls back to the default name). */
  setName(name: string): void {
    this.current.name = sanitizeName(name, this.catalog);
  }

  /** Replaces the build with a preset's (frames.json → presets). */
  applyPreset(name: string): void {
    const p = this.catalog.frameBuild.presets.find((x) => x.name === name);
    if (p) this.current.build = { ...p.build };
  }

  setAim(id: string): void {
    this.catalog.aimModeIndex(id);
    this.current.aim = id;
  }

  setEnemies(n: number): void {
    this.current.enemies = snapEnemyCount(n, this.catalog);
  }

  /** The loadout for launching (every hardpoint filled: check() passes). */
  get setup(): BattleSetup {
    return { ...this.current, build: { ...this.current.build }, slots: filledSlots(this.current) };
  }

  /**
   * Adds the item to the first empty hardpoint, or empties its hardpoint if equipped. The other
   * hardpoints keep their places (and keys).
   */
  toggle(id: string): ToggleResult {
    const i = this.current.slots.indexOf(id);
    if (i >= 0) {
      this.current.slots[i] = null;
      return 'removed';
    }
    const free = this.current.slots.indexOf(null);
    if (free < 0) return 'full';
    this.catalog.weapon(id);
    this.current.slots[free] = id;
    return 'added';
  }

  remove(id: string): void {
    this.current.slots = this.current.slots.map((s) => (s === id ? null : s));
  }

  check(): LoadoutCheck {
    return checkLoadout(this.current, this.catalog);
  }
}
