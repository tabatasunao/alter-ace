import type { EmpTool } from '../../../data/types';
import type { ToolEffect } from '../ToolEffect';

/** Stuns nearby enemies and deletes their shots in the blast (EMP Burst). */
export const emp: ToolEffect<EmpTool> = {
  use({ world, player: P, tool }) {
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
  },
};
