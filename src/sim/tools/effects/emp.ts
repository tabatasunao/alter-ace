import type { EmpTool } from '../../../data/types';
import type { Player } from '../../entities';
import type { World } from '../../World';
import { releaseTicks, type ToolEffect } from '../ToolEffect';

/** Stuns enemies within the radius, deletes their shots in it, and shows the shockwave. */
function empBurst(world: World, P: Player, tool: EmpTool): void {
  const r2 = tool.radius * tool.radius;
  world.grid.eachNear(P.x, P.y, tool.radius, (u) => {
    if (u.team === P.team || !u.alive) return;
    const dx = u.x - P.x;
    const dy = u.y - P.y;
    if (dx * dx + dy * dy <= r2) u.stunT = Math.max(u.stunT, tool.stun);
  });
  const shots = world.shots;
  for (let j = shots.length - 1; j >= 0; j--) {
    const p = shots[j]!;
    if (p.team !== P.team && (p.x - P.x) ** 2 + (p.y - P.y) ** 2 <= r2) {
      shots[j] = shots[shots.length - 1]!;
      shots.pop();
    }
  }
  world.addFx({ type: 'emp', x: P.x, y: P.y, r: tool.radius, t: 0, life: 0.5 });
}

/** Stuns nearby enemies and deletes their shots in the blast (EMP Burst). During super release it bursts at the start and every `releaseInterval`. */
export const emp: ToolEffect<EmpTool> = {
  use({ world, player, tool }) {
    empBurst(world, player, tool);
  },
  release: {
    start({ world, player, tool }) {
      empBurst(world, player, tool);
    },
    step({ world, player, tool }, from, to, duration) {
      for (let i = releaseTicks(from, to, tool.releaseInterval, duration); i > 0; i--) empBurst(world, player, tool);
    },
  },
};
