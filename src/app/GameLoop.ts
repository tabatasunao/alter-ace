import type { TimeStepper } from '../core/timestep';

/** requestAnimationFrame driver: turns real time into simulation steps, then renders. */
export class GameLoop {
  private last = 0;

  constructor(
    private readonly stepper: TimeStepper,
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    requestAnimationFrame((now) => {
      this.last = now;
      this.frame(now);
    });
  }

  private readonly frame = (now: number): void => {
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.stepper.advance(elapsed, this.update);
    this.render();
    requestAnimationFrame(this.frame);
  };
}
