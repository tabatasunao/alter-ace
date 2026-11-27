/** What input should do right now. */
export type InputMode = 'menu' | 'options' | 'launch' | 'playing' | 'paused' | 'ended';

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
  /** The screen's main action: launch from the hangar; show the result now, then sortie again. */
  confirm(): void;
  /** The screen's way back: from the result to the hangar. */
  back(): void;
}
