import type { Point } from '../../core/math';
import type { MovementDef } from '../../data/types';
import type { Player } from '../entities';

export interface SteerContext<M extends MovementDef = MovementDef> {
  readonly player: Player;
  /** Movement input this step, length <= 1. */
  readonly input: Point;
  /** The frame's top speed, with running statuses applied. */
  readonly topSpeed: number;
  readonly dt: number;
  readonly config: M;
}

export interface DashEndContext<M extends MovementDef = MovementDef> {
  readonly player: Player;
  /** The dash's velocity (direction matters, not size). */
  readonly dashVx: number;
  readonly dashVy: number;
  readonly topSpeed: number;
  readonly config: M;
}

/**
 * How the ace's velocity responds to input. PlayerMovementSystem integrates position,
 * handles dashes, lunges and walls; a model only decides velocity.
 *
 * To add a model: add its def to MovementDef (src/data/types.ts), implement this,
 * register it in registry.ts, and select it in battle.json → player.movement.model.
 */
export interface MovementModel<M extends MovementDef = MovementDef> {
  /** Updates player.vx / player.vy for this step. */
  steer(ctx: SteerContext<M>): void;
  /** Sets the velocity the ace keeps when a dash ends. Omit to keep the pre-dash velocity. */
  afterDash?(ctx: DashEndContext<M>): void;
}
