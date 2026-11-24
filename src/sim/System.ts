import type { Player } from './entities';
import type { World } from './World';

/** One step of game logic over the world. Systems run in a fixed order each frame (see pipelines.ts). */
export interface System {
  update(world: World, dt: number): void;
}

/** Runs systems in order. */
export class Simulation {
  constructor(readonly systems: readonly System[]) {}

  step(world: World, dt: number): void {
    for (const system of this.systems) system.update(world, dt);
  }
}

/** The ace, if it is alive and the battle is still on. */
export function activePlayer(world: World): Player | null {
  const P = world.player;
  return P && P.alive && !world.status.over ? P : null;
}
