import type { Message } from './messages';
export type BannerTone = 'good' | 'warn' | '';

/** Everything the simulation tells the outside world. The UI subscribes; the sim never touches the DOM. */
export interface GameEvents {
  banner: { msg: Message; tone: BannerTone; minor: boolean };
  battleEnded: { win: boolean };
  /** Dash pressed while recharging, or Full Arms pressed before the gauge is full. */
  actionDenied: { action: 'dash' | 'release' };
  /** The hangar's background skirmish has run out of one side. */
  demoExhausted: Record<string, never>;
}
