import { slotIndex, type ActionId, type KeyBindings } from '../game/settings';

const NAMES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  shift: 'Shift',
  control: 'Ctrl',
  alt: 'Alt',
  escape: 'Esc',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

/** How a key (`KeyboardEvent.key`, lowercased) is shown: Space, Shift, ↑, W, 5… */
export function keyLabel(key: string): string {
  return NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));
}

/** Movement direction per action, for held keys. */
const MOVES: Readonly<Record<string, readonly [number, number]>> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Key → action lookups for the current bindings, plus the data's fixed aim mode keys (5–0). */
export class KeyMap {
  private readonly byKey = new Map<string, ActionId>();

  constructor(
    readonly bindings: KeyBindings,
    private readonly aimKeys: readonly string[],
  ) {
    for (const [action, keys] of Object.entries(bindings)) for (const k of keys) if (!this.byKey.has(k)) this.byKey.set(k, action);
  }

  /** The action bound to this key, or null. */
  action(key: string): ActionId | null {
    return this.byKey.get(key) ?? null;
  }

  /** The movement direction this key adds while held, or null. */
  move(key: string): readonly [number, number] | null {
    const a = this.byKey.get(key);
    return a ? (MOVES[a] ?? null) : null;
  }

  /** The hardpoint index (0-based) this key selects, or -1. */
  slot(key: string): number {
    const a = this.byKey.get(key);
    return a ? slotIndex(a) : -1;
  }

  /** The aim mode this key picks directly (data keys, unless the key is bound to an action), or -1. */
  aim(key: string): number {
    return this.byKey.has(key) ? -1 : this.aimKeys.indexOf(key);
  }

  /** The keys shown for an action ('' when unbound). */
  labels(action: ActionId): string[] {
    return (this.bindings[action] ?? []).map(keyLabel);
  }

  /** The action's first key as shown ('–' when unbound). */
  label(action: ActionId): string {
    return this.labels(action)[0] ?? '–';
  }
}
