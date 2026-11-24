import type { Point } from '../core/math';

/**
 * Where the ace's movement comes from. The sim depends on this abstraction; the keyboard,
 * the touch joystick and test scripts implement it.
 */
export interface MoveInput {
  /** Raw movement vector; may be longer than 1 (the sim normalizes it). */
  read(): Point;
}

/** No movement: for demos and tests. */
export const NO_INPUT: MoveInput = { read: () => ({ x: 0, y: 0 }) };
