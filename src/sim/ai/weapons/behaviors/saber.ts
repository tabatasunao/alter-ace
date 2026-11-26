import { clamp } from '../../../../core/math';
import type { SaberUnitWeapon } from '../../../../data/types';
import { arcSlash } from '../../../attacks';
import { clash, holdsBlade } from '../../../clash';
import { armyHit, unitTone, type Soldier, type Unit, type UnitAction } from '../../../entities';
import type { World } from '../../../World';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

/** Lunges at the target and slashes an arc when it arrives (a semi-ace's beam saber). */
export const saber: UnitWeaponBehavior<SaberUnitWeapon> = {
  fire({ world, unit: u, weapon: w, target }) {
    const angle = Math.atan2(target.y - u.y, target.x - u.x);
    const go = Math.max(0, Math.hypot(target.x - u.x, target.y - u.y) - w.stopDistance);
    u.action = new SaberLunge(world, u, w, angle, go);
  },
};

/**
 * A straight dash that ends in the slash. The unit's AI waits while it runs. The ace, if it has its
 * own saber out, clashes with the slash instead of taking it.
 */
class SaberLunge implements UnitAction {
  readonly holdsAI = true;
  readonly sightLine = null;
  readonly blade = true;
  private remaining: number;
  private readonly vx: number;
  private readonly vy: number;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    private readonly w: SaberUnitWeapon,
    private readonly angle: number,
    distance: number,
  ) {
    const duration = clamp(distance / w.lungeSpeed, 1 / 60, w.maxLunge);
    this.remaining = duration;
    this.vx = (Math.cos(angle) * distance) / duration;
    this.vy = (Math.sin(angle) * distance) / duration;
  }

  step(dt: number): boolean {
    const { world, u, w } = this;
    const margin = world.catalog.battle.ai.edgeMargin;
    this.remaining -= dt;
    u.vx = this.vx;
    u.vy = this.vy;
    u.x = clamp(u.x + this.vx * dt, margin, world.width - margin);
    u.y = clamp(u.y + this.vy * dt, margin, world.height - margin);
    if (this.remaining > 0) return false;
    u.vx = u.vy = 0;
    const parry = (t: Unit) => {
      if (t.kind !== 'player' || !holdsBlade(t)) return false;
      clash(world, t, u);
      return true;
    };
    arcSlash(world, u, this.angle, { reach: w.slash, half: w.arcHalfAngle, closeRange: w.closeRange, dmg: w.dmg }, armyHit(u, w), unitTone(u), parry);
    return true;
  }
}
