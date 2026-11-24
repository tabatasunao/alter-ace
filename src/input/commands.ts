/** What input should do right now. */
export type InputMode = 'menu' | 'playing' | 'paused' | 'ended';

/** Receiver of player commands from any input device. The App implements it. */
export interface CommandSink {
  inputMode(): InputMode;
  selectSlot(index: number): void;
  setAimIndex(index: number): void;
  cycleAim(delta: number): void;
  dash(): void;
  superRelease(): void;
  reload(): void;
  zoomBy(factor: number): void;
  /** Toggles pause, or sets it when `force` is given. */
  togglePause(force?: boolean): void;
}

/** Key → action lookups that depend on the data (slot count, aim mode keys). */
export interface KeyBindings {
  /** Hardpoint index for this key, or -1. */
  slotForKey(key: string): number;
  /** Aim mode index for this key, or -1. */
  aimForKey(key: string): number;
}

export function keyBindings(slotCount: number, aimKeys: readonly string[]): KeyBindings {
  return {
    slotForKey: (key) => {
      const n = key.length === 1 ? Number.parseInt(key, 10) : Number.NaN;
      return n >= 1 && n <= slotCount ? n - 1 : -1;
    },
    aimForKey: (key) => aimKeys.indexOf(key),
  };
}
