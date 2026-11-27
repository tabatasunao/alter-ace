import { chargeRelease } from '../release';
import { activePlayer, type System } from '../System';
import type { World } from '../World';
import { msg } from '../messages';

/**
 * Full Arms over time: while it is not running the gauge fills at its per-second rate (kills and
 * close dodges add the rest). When it ends, a Full Arms that downed enough enemies gets a banner
 * and a callout.
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
    run.elapsed += dt;
    if (run.elapsed < run.duration) return;
    P.release = null;
    const kills = world.stats.kills - run.killsAtStart;
    if (kills >= world.catalog.battle.praise.releaseMinKills) {
      world.banner(msg('banner.fullArms', { n: kills }), 'good', true);
      world.addFx({ type: 'callout', x: P.x, y: P.y - 30, t: 0, life: 1.1, msg: msg('callout.kills', { n: kills }), tone: 'release', size: 22 });
    }
  }
}
