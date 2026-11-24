/** Turns real elapsed time into simulation steps. The game loop depends on this, not on a policy. */
export interface TimeStepper {
  /** Runs zero or more `tick(dt)` calls for `elapsedSeconds` of real time; returns how many. */
  advance(elapsedSeconds: number, tick: (dt: number) => void): number;
}

/**
 * One step per frame, capped so a stall doesn't teleport units. Smooth at any refresh rate.
 */
export class VariableStep implements TimeStepper {
  constructor(readonly maxStep: number) {}

  advance(elapsedSeconds: number, tick: (dt: number) => void): number {
    if (elapsedSeconds <= 0) return 0;
    tick(Math.min(this.maxStep, elapsedSeconds));
    return 1;
  }
}
