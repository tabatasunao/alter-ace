import type { ToolDef } from '../../data/types';
import type { Player } from '../entities';
import type { World } from '../World';

export interface ToolContext<T extends ToolDef = ToolDef> {
  readonly world: World;
  readonly player: Player;
  readonly tool: T;
}

/** What a tool on a hardpoint does during super release (src/sim/release.ts), whatever its recharge. */
export interface ToolRelease<T extends ToolDef = ToolDef> {
  /** When the release starts. */
  start(ctx: ToolContext<T>, duration: number): void;
  /** Each step while it runs; `from` and `to` are the seconds since it started, before and after the step. */
  step?(ctx: ToolContext<T>, from: number, to: number, duration: number): void;
}

/**
 * What one kind of tool does when used, and during super release. Recharge is handled by the
 * caller (useTool).
 *
 * To add a tool effect: add its def type to ToolDef (src/data/types.ts), implement this
 * interface in effects/, and register it in registry.ts.
 */
export interface ToolEffect<T extends ToolDef = ToolDef> {
  use(ctx: ToolContext<T>): void;
  release: ToolRelease<T>;
}

/**
 * How many times a repeating release effect fires between `from` and `to` seconds into a release:
 * the multiples of `interval` in (from, to] that come before the release ends. The start is the
 * effect's own `start`.
 */
export function releaseTicks(from: number, to: number, interval: number, duration: number): number {
  const last = Math.min(to, duration - 1e-6);
  return Math.max(0, Math.floor(last / interval) - Math.floor(from / interval));
}
