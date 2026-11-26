import type { OverboostTool } from '../../../data/types';
import type { Player } from '../../entities';
import { addStatus } from '../../statuses';
import type { ToolEffect } from '../ToolEffect';

/** The Overboost status for `seconds`. Same id as the tool's own use, so the two never stack. */
function boost(player: Player, tool: OverboostTool, seconds: number): void {
  addStatus(player, {
    id: tool.id,
    label: tool.name,
    remaining: seconds,
    mods: { speed: tool.speedMul, fireInterval: tool.fireIntervalMul, damageTaken: tool.damageTakenMul },
    heal: 0,
    ring: true,
  });
}

/** A few seconds of extra speed, faster fire and damage reduction (Overboost). During super release it runs for the whole release. */
export const overboost: ToolEffect<OverboostTool> = {
  use({ player, tool }) {
    boost(player, tool, tool.duration);
  },
  release: {
    start({ player, tool }, duration) {
      const running = player.statuses.find((s) => s.id === tool.id)?.remaining ?? 0;
      boost(player, tool, Math.max(running, duration));
    },
  },
};
