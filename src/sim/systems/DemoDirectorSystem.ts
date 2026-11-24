import type { System } from '../System';
import type { World } from '../World';

/** Signals when the hangar skirmish has lost a side for a moment, so the app can start a new one. */
export class DemoDirectorSystem implements System {
  /** Seconds since a side was lost. */
  private sideLost = 0;

  update(world: World, dt: number): void {
    const [allies, enemies] = world.centroids;
    if (allies && enemies) return;
    this.sideLost += dt;
    if (this.sideLost > world.catalog.battle.timing.demoResetDelay) world.events.emit('demoExhausted', {});
  }
}
