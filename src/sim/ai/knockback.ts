import { clamp } from '../../core/math';
import type { Soldier, UnitAction } from '../entities';
import type { World } from '../World';

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
    const { world, u } = this;
    const k = Math.max(0, 1 - this.t / this.time);
    const margin = world.catalog.battle.ai.edgeMargin;
    u.vx = this.vx * k;
    u.vy = this.vy * k;
    u.x = clamp(u.x + u.vx * dt, margin, world.width - margin);
    u.y = clamp(u.y + u.vy * dt, margin, world.height - margin);
    this.t += dt;
    if (this.t < this.time) return false;
    u.vx = u.vy = 0;
    return true;
  }
}
