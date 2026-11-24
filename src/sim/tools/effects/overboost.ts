import type { OverboostTool } from '../../../data/types';
import { addStatus } from '../../statuses';
import type { ToolEffect } from '../ToolEffect';

/** A few seconds of extra speed, faster fire and damage reduction (Overboost). */
export const overboost: ToolEffect<OverboostTool> = {
  use({ player, tool }) {
    addStatus(player, {
      id: tool.id,
      label: tool.name,
      remaining: tool.duration,
      mods: { speed: tool.speedMul, fireInterval: tool.fireIntervalMul, damageTaken: tool.damageTakenMul },
      heal: 0,
      ring: true,
    });
  },
};
