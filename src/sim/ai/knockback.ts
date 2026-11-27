import type { Soldier, UnitAction } from '../entities';
import type { World } from '../World';
import { moveUnit } from './unitMotion';

/**
 * Throws a unit along (vx, vy), slowing to a stop over `time` s. It replaces whatever the unit was
 * doing (a lance charge or a lunge is lost) and holds its AI until it lands.
 */
export function knockBack(world: World, u: Soldier, vx: number, vy: number, time: number): void {
  u.action = new Knockback(world, u, vx, vy, time);
}

class Knockback implements UnitAction {
  readonly holdsAI = true;
  readonly sightLine = null;
  private t = 0;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    private readonly vx: number,
    private readonly vy: number,
    private readonly time: number,
  ) {}

  step(dt: number): boolean {
    const k = Math.max(0, 1 - this.t / this.time);
    moveUnit(this.world, this.u, this.vx * k, this.vy * k, dt);
    this.t += dt;
    if (this.t < this.time) return false;
    this.u.vx = this.u.vy = 0;
    return true;
  }
}
