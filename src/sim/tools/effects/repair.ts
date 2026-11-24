import type { RepairTool } from '../../../data/types';
import { addStatus } from '../../statuses';
import type { ToolEffect } from '../ToolEffect';

/** Heals a share of max HP over a few seconds (Repair Nanites). */
export const repair: ToolEffect<RepairTool> = {
  use({ player, tool }) {
    addStatus(player, {
      id: tool.id,
      label: tool.name,
      remaining: tool.duration,
      mods: {},
      heal: (player.maxHp * tool.healFraction) / tool.duration,
      ring: false,
    });
  },
};
