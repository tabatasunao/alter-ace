import type { ToolDef } from '../../data/types';
import type { Player } from '../entities';
import type { World } from '../World';

export interface ToolContext<T extends ToolDef = ToolDef> {
  readonly world: World;
  readonly player: Player;
  readonly tool: T;
}

/**
 * What one kind of tool does when used. Recharge is handled by the caller (useTool).
 *
 * To add a tool effect: add its def type to ToolDef (src/data/types.ts), implement this
 * interface in effects/, and register it in registry.ts.
 */
export interface ToolEffect<T extends ToolDef = ToolDef> {
  use(ctx: ToolContext<T>): void;
}
