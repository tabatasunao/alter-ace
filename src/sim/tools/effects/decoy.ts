import type { DecoyTool } from '../../../data/types';
import type { ToolEffect } from '../ToolEffect';

/** Drops a beacon that nearby enemies switch to at once (Decoy Beacon). */
export const decoy: ToolEffect<DecoyTool> = {
  use({ world, player: P, tool }) {
    const beacon = world.factory.decoy(tool, P.team, P.x, P.y);
    world.units.push(beacon);
    world.decoys.push(beacon);
    world.grid.eachNear(P.x, P.y, tool.pullRadius, (u) => {
      if (u.team !== P.team && u.kind === 'soldier') u.retarget = 0;
    });
  },
};
