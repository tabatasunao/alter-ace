import { clamp } from '../core/math';
import { LOCALES, t, type Locale } from '../i18n';
/** A rebindable action: movement, the ace's commands, a hardpoint (`slot:1`…), pause and zoom. */
export type ActionId = string;

/** The action that selects hardpoint `index` (0-based). */
export function slotAction(index: number): ActionId {
  return `slot:${index + 1}`;
}

/** The hardpoint (0-based) an action selects, or -1 for any other action. */
export function slotIndex(id: ActionId): number {
  return id.startsWith('slot:') ? Number(id.slice(5)) - 1 : -1;
}

/** An action's name in the current language. */
export function actionLabel(id: ActionId): string {
  const slot = slotIndex(id);
  return slot >= 0 ? t('action.slot', { n: slot + 1 }) : t(`action.${id}`);
}

/** Keys per action, as `KeyboardEvent.key` lowercased (' ' is Space). At most two each. */
export type KeyBindings = Record<ActionId, string[]>;

/** The player's preferences, kept in the browser. */
export interface Settings {
  /** Screen shake strength, 0–1. */
  shake: number;
  /** Screen flash strength, 0–1. */
  flash: number;
  /** Sound effect volume, 0–1. */
  sfx: number;
  /** Music volume, 0–1. */
  music: number;
  /** HUD size multiplier (one of HUD_SIZES). */
  hudScale: number;
  /** The interface language, or null to follow the browser. */
  locale: Locale | null;
  keys: KeyBindings;
}

/** The HUD sizes the options offer: the multiplier and its label's translation key. */
export const HUD_SIZES = [
  { scale: 1, label: 'options.hud.normal' },
  { scale: 1.15, label: 'options.hud.large' },
  { scale: 1.3, label: 'options.hud.larger' },
] as const;
export const KEYS_PER_ACTION = 2;

/** Every rebindable action for a loadout of `slotCount` hardpoints, in the order the options list them. */
export function actionList(slotCount: number): ActionId[] {
  return [
    'up',
    'down',
    'left',
    'right',
    'dash',
    'release',
    ...Array.from({ length: slotCount }, (_, i) => slotAction(i)),
    'aimPrev',
    'aimNext',
    'reload',
    'pause',
    'zoomIn',
    'zoomOut',
  ];
}

/** The default keys for `slotCount` hardpoints. */
export function defaultKeys(slotCount: number): KeyBindings {
  const keys: KeyBindings = {
    up: ['w', 'arrowup'],
    down: ['s', 'arrowdown'],
    left: ['a', 'arrowleft'],
    right: ['d', 'arrowright'],
    dash: ['shift'],
    release: [' '],
    aimPrev: ['q'],
    aimNext: ['e'],
    reload: ['r'],
    pause: ['p', 'escape'],
    zoomIn: ['=', '+'],
    zoomOut: ['-', '_'],
  };
  for (let i = 0; i < slotCount; i++) keys[slotAction(i)] = i < 9 ? [String(i + 1)] : [];
  return keys;
}

export function defaultSettings(slotCount: number): Settings {
  return { shake: 1, flash: 1, sfx: 0.8, music: 0.6, hudScale: 1, locale: null, keys: defaultKeys(slotCount) };
}

const unit = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : fallback);

/**
 * Clean settings from whatever storage held. Unknown values fall back to the defaults; key lists
 * keep only strings, at most two per action, and a key is kept only by the first action that names it.
 */
export function sanitizeSettings(raw: unknown, slotCount: number): Settings {
  const out = defaultSettings(slotCount);
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  out.shake = unit(r.shake, out.shake);
  out.flash = unit(r.flash, out.flash);
  out.sfx = unit(r.sfx, out.sfx);
  out.music = unit(r.music, out.music);
  if (HUD_SIZES.some((h) => h.scale === r.hudScale)) out.hudScale = r.hudScale as number;
  if (LOCALES.some((l) => l.id === r.locale)) out.locale = r.locale as Locale;
  if (r.keys && typeof r.keys === 'object') {
    const taken = new Set<string>();
    for (const id of actionList(slotCount)) {
      const list = (r.keys as Record<string, unknown>)[id];
      if (!Array.isArray(list)) {
        out.keys[id] = out.keys[id]!.filter((k) => !taken.has(k));
      } else {
        out.keys[id] = list.filter((k): k is string => typeof k === 'string' && k.length > 0 && !taken.has(k)).slice(0, KEYS_PER_ACTION);
      }
      for (const k of out.keys[id]!) taken.add(k);
    }
  }
  return out;
}

/**
 * Binds `key` to `action` in position `index` (0 primary, 1 secondary), taking it from any action
 * that had it. `key` null clears that position. Returns new bindings; the old ones are not changed.
 */
export function rebind(keys: KeyBindings, action: ActionId, index: number, key: string | null): KeyBindings {
  const next: KeyBindings = {};
  for (const [id, list] of Object.entries(keys)) next[id] = key === null ? [...list] : list.filter((k) => k !== key);
  const list = [...(next[action] ?? [])];
  if (key === null) list.splice(index, 1);
  else if (index < list.length) list[index] = key;
  else list.push(key);
  next[action] = [...new Set(list)].slice(0, KEYS_PER_ACTION);
  return next;
}

/** Where the settings are remembered. */
export interface SettingsStore {
  /** The saved value as stored (unvalidated), or null. */
  load(): unknown;
  save(settings: Settings): void;
}

/** Browser storage; fails quietly when storage is unavailable (private mode, blocked). */
export class LocalStorageSettingsStore implements SettingsStore {
  constructor(private readonly key: string) {}

  load(): unknown {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(settings: Settings): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }
}
