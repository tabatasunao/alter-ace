import type { System } from '../System';
import type { World } from '../World';
import { msg } from '../messages';

/** One-off banners about how the battle is going. Built per battle, so its flags start fresh. */
export class AlertSystem implements System {
  private readonly shown = { half: false, lost: false, crit: false, lastWave: false };

  update(world: World): void {
    const P = world.player;
    if (world.status.over || !P) return;
    const f = this.shown;
    const s = world.stats;
    const cfg = world.catalog.battle.alerts;

    if (!f.half && s.allyAlive <= s.allyTotal / 2) {
      f.half = true;
      world.banner(msg('banner.halfAllies'), 'warn');
    }
    if (!f.lost && s.allyAlive <= 0) {
      f.lost = true;
      world.banner(msg('banner.allAllies'), 'warn');
    }
    if (P.alive) {
      if (P.hp < P.maxHp * cfg.criticalHp) {
        if (!f.crit) {
          f.crit = true;
          world.banner(msg('banner.hpCritical'), 'warn');
        }
      } else if (P.hp > P.maxHp * cfg.criticalReset) {
        f.crit = false;
      }
    }
    if (!f.lastWave && s.enemyQueue.length === 0 && s.enemyTotal > world.catalog.armies.battle.enemies.initial) {
      f.lastWave = true;
      world.banner(msg('banner.finalReserves'), 'good');
    }
  }
}
