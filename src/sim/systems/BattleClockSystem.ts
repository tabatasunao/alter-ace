import type { System } from '../System';
import type { World } from '../World';

/** Runs the battle clock until the battle ends. */
export class BattleClockSystem implements System {
  update(world: World, dt: number): void {
    if (!world.status.over) world.t += dt;
  }
}
