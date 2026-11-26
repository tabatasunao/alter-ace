import type { System } from '../System';
import type { World } from '../World';

/** How far a shake settles over `shakeTime`: e^-5, under 1%. */
const SHAKE_SETTLE = 5;
const SHAKE_FLOOR = 0.2;

/** Settles screen shake, flash and the hurt edges, and counts down the hit-stop gap. Runs during hit-stop. */
export class ImpactSystem implements System {
  readonly duringFreeze = true;

  update(world: World, dt: number): void {
    const s = world.impact;
    const cfg = world.catalog.battle.impact;
    s.clock += dt;
    if (s.freezeGap > 0) s.freezeGap -= dt;
    if (s.shake > 0) {
      s.shake *= Math.exp((-SHAKE_SETTLE * dt) / cfg.shakeTime);
      if (s.shake < SHAKE_FLOOR) s.shake = 0;
    }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - (s.flashPeak * dt) / cfg.flashTime);
    if (s.hurt > 0) s.hurt = Math.max(0, s.hurt - dt / cfg.hurtTime);
  }
}
