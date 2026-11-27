import { activePlayer, type System } from '../System';
import type { World } from '../World';
import { msg } from '../messages';

/**
 * Banners that praise the ace: every kill milestone, and a streak of kills in a short window
 * (outside super release, which has its own banner). Built per battle, so its counters start fresh.
 */
export class PraiseSystem implements System {
  private milestone = 0;
  /** Recent (battle time, kill count) samples, oldest first from `head`, covering the streak window. */
  private readonly samples: { t: number; kills: number }[] = [];
  private head = 0;
  private quietUntil = 0;

  update(world: World): void {
    const P = activePlayer(world);
    if (!P) return;
    const cfg = world.catalog.battle.praise;
    const kills = world.stats.kills;

    const reached = Math.floor(kills / cfg.killMilestone);
    if (reached > this.milestone) {
      this.milestone = reached;
      world.banner(msg('banner.killMilestone', { n: reached * cfg.killMilestone }), 'good', true);
    }

    if (P.release) {
      // The release's own banner counts its kills; the streak starts afresh after it.
      this.samples.length = 0;
      this.head = 0;
      return;
    }
    const s = cfg.streak;
    this.samples.push({ t: world.t, kills });
    while (this.samples[this.head]!.t < world.t - s.window) this.head++;
    if (this.head > 512) {
      this.samples.splice(0, this.head);
      this.head = 0;
    }
    const streak = kills - this.samples[this.head]!.kills;
    if (streak >= s.kills && world.t >= this.quietUntil) {
      this.quietUntil = world.t + s.cooldown;
      world.banner(msg('banner.streak', { n: streak, s: s.window }), 'good', true);
    }
  }
}
