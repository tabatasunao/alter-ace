export type BannerTone = 'good' | 'warn' | '';

/** Everything the simulation tells the outside world. The UI subscribes; the sim never touches the DOM. */
export interface GameEvents {
  banner: { text: string; tone: BannerTone; minor: boolean };
  battleEnded: { win: boolean };
  /** A tool key was pressed while it was recharging. */
  slotDenied: { slot: number };
  /** The hangar's background skirmish has run out of one side. */
  demoExhausted: Record<string, never>;
}
