import { msg, type Message } from '../sim/messages';
import type { World } from '../sim/World';

/** What a tip rule looks at: the finished sortie, and how an action's key is shown. */
export interface TipContext {
  readonly world: World;
  readonly key: (action: string) => string;
}

interface TipRule {
  readonly when: (c: TipContext) => boolean;
  readonly text: (c: TipContext) => Message;
}

/** Tips for a lost sortie, in priority order. The first rule that applies gives the tip. */
const DEFEAT_TIPS: readonly TipRule[] = [
  {
    when: ({ world }) => (world.player?.releaseCharge ?? 0) >= 1,
    text: ({ world, key }) => {
      const cut = Math.round((1 - world.catalog.battle.player.superRelease.damageTakenMul) * 100);
      return msg('tip.fullArms', { key: key('release'), cut });
    },
  },
  {
    when: ({ world }) => world.stats.dodges === 0,
    text: ({ key }) => msg('tip.dash', { key: key('dash') }),
  },
  {
    when: () => true,
    text: () => msg('tip.matchups'),
  },
];

/** The tip shown on the result card of a lost sortie. */
export function defeatTip(c: TipContext): Message {
  return DEFEAT_TIPS.find((t) => t.when(c))!.text(c);
}
