import type { Player } from './entities';
import type { World } from './World';

/** One step of game logic over the world. Systems run in a fixed order each frame (see pipelines.ts). */
export interface System {
  /** Keeps running during hit-stop (effects, camera, impact); every other system holds. */
  readonly duringFreeze?: boolean;
  update(world: World, dt: number): void;
}

/**
 * Runs systems in order. During hit-stop (`world.impact.freeze`) only `duringFreeze` systems run;
 * during slow motion every system gets a scaled `dt`.
 */
export class Simulation {
  constructor(readonly systems: readonly System[]) {}

  step(world: World, dt: number): void {
    const impact = world.impact;
    if (impact.freeze > 0) {
      impact.freeze -= dt;
      for (const system of this.systems) if (system.duringFreeze) system.update(world, dt);
      return;
    }
    if (impact.slow > 0) {
      impact.slow -= dt;
      dt *= impact.slowScale;
    }
    for (const system of this.systems) system.update(world, dt);
  }
}

/** The ace, if it is alive and the battle is still on. */
export function activePlayer(world: World): Player | null {
  const P = world.player;
  return P && P.alive && !world.status.over ? P : null;
}
