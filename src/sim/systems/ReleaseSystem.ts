import { chargeRelease } from '../release';
import { activePlayer, type System } from '../System';
import { effectFor } from '../tools/registry';
import type { World } from '../World';

/**
 * Super release over time: with no release running the gauge fills at its per-second rate (kills
 * and close dodges add the rest); while one runs, every tool hardpoint runs its release step.
 * When it ends, a release that downed enough enemies gets a banner and a callout.
 */
export class ReleaseSystem implements System {
  update(world: World, dt: number): void {
    const P = activePlayer(world);
    if (!P) return;
    const run = P.release;
    if (!run) {
      chargeRelease(world, P, world.catalog.battle.player.superRelease.charge.perSecond * dt);
      return;
    }
    const from = run.elapsed;
    run.elapsed += dt;
    for (const slot of P.slots) {
      if (slot.kind === 'tool') effectFor(slot.def).release.step?.({ world, player: P, tool: slot.def }, from, run.elapsed, run.duration);
    }
    if (run.elapsed < run.duration) return;
    P.release = null;
    const kills = world.stats.kills - run.killsAtStart;
    if (kills >= world.catalog.battle.praise.releaseMinKills) {
      world.banner(`Super release: ${kills} down`, 'good', true);
      world.addFx({ type: 'callout', x: P.x, y: P.y - 30, t: 0, life: 1.1, text: `×${kills}`, tone: 'accent', size: 22 });
    }
  }
}
