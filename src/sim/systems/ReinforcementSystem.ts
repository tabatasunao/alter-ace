import { ENEMY } from '../entities';
import { spawnGroup } from '../spawning';
import type { System } from '../System';
import type { World } from '../World';
import { msg } from '../messages';

/** Brings queued enemies in from the east edge when the field thins out or on a timer. */
export class ReinforcementSystem implements System {
  update(world: World, dt: number): void {
    const s = world.stats;
    if (world.status.over || s.enemyQueue.length === 0) return;
    const cfg = world.catalog.armies.reinforcements;
    s.reserveTimer -= dt;
    if (s.enemyField >= cfg.fieldThreshold && s.reserveTimer > 0) return;

    const n = Math.min(cfg.battalion, s.enemyQueue.length);
    const group = s.enemyQueue.splice(0, n);
    const y = world.random.range(cfg.yMargin, world.height - cfg.yMargin);
    spawnGroup(world, group, ENEMY, world.width - cfg.edgeOffset, y, -1);
    s.enemyField += n;
    s.reserveTimer = cfg.interval;
    world.banner(msg('banner.reinforcements', { n }), 'warn');
  }
}
