import type { System } from '../System';
import type { World } from '../World';

/** Wins the battle once no enemy is left on the field or in reserve. (Defeat happens in Combat.) */
export class VictorySystem implements System {
  update(world: World): void {
    if (world.status.over) return;
    if (world.stats.enemyField <= 0 && world.stats.enemyQueue.length === 0) world.endBattle(true);
  }
}
