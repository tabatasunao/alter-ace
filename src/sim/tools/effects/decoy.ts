import type { DecoyTool } from '../../../data/types';
import type { Player } from '../../entities';
import type { World } from '../../World';
import { releaseTicks, type ToolEffect } from '../ToolEffect';

/** Drops a beacon at the ace's position and makes nearby enemies pick a new target at once. */
function dropDecoy(world: World, P: Player, tool: DecoyTool, hp: number, life: number): void {
  const beacon = world.factory.decoy(tool, P.team, P.x, P.y, hp, life);
  world.units.push(beacon);
  world.decoys.push(beacon);
  world.grid.eachNear(P.x, P.y, tool.pullRadius, (u) => {
    if (u.team !== P.team && u.kind === 'soldier') u.retarget = 0;
  });
}

/**
 * Drops a beacon that nearby enemies switch to at once (Decoy Beacon). During super release it
 * leaves a weaker, shorter-lived afterimage at the start and every `releaseInterval`.
 */
export const decoy: ToolEffect<DecoyTool> = {
  use({ world, player, tool }) {
    dropDecoy(world, player, tool, tool.hp, tool.life);
  },
  release: {
    start({ world, player, tool }) {
      dropDecoy(world, player, tool, tool.releaseHp, tool.releaseLife);
    },
    step({ world, player, tool }, from, to, duration) {
      for (let i = releaseTicks(from, to, tool.releaseInterval, duration); i > 0; i--) dropDecoy(world, player, tool, tool.releaseHp, tool.releaseLife);
    },
  },
};
