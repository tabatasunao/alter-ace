import type { RepairTool } from '../../../data/types';
import type { Player } from '../../entities';
import { addStatus } from '../../statuses';
import type { ToolEffect } from '../ToolEffect';

/** Heals `healFraction` of max HP over `seconds` as a status with this id. */
function mend(player: Player, tool: RepairTool, id: string, seconds: number): void {
  addStatus(player, {
    id,
    label: tool.name,
    remaining: seconds,
    mods: {},
    heal: (player.maxHp * tool.healFraction) / seconds,
    ring: false,
  });
}

/**
 * Heals a share of max HP over a few seconds (Repair Nanites). During super release it heals the
 * same share over the release, on top of a repair already running.
 */
export const repair: ToolEffect<RepairTool> = {
  use({ player, tool }) {
    mend(player, tool, tool.id, tool.duration);
  },
  release: {
    start({ player, tool }, duration) {
      mend(player, tool, `${tool.id}:release`, duration);
    },
  },
};
