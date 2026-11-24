import type { LanceUnitWeapon } from '../../../../data/types';
import { aimAhead } from '../../aim';
import { lineStrike } from '../../../attacks';
import { armyHit, unitTone, type SightLine, type Soldier, type Unit, type UnitAction } from '../../../entities';
import type { World } from '../../../World';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

/** A charged beam (Beam lance). Firing starts the charge; the beam fires when it ends. */
export const lance: UnitWeaponBehavior<LanceUnitWeapon> = {
  fire({ world, unit, weapon, target }) {
    unit.action = new LanceCharge(world, unit, weapon, target);
  },
};

/**
 * The sight line swings after where the target will be when the beam fires, freezes for the last
 * `lock` seconds (the cue to dodge), then the beam hits everything on the line. A dead target
 * cancels it.
 */
class LanceCharge implements UnitAction, SightLine {
  readonly holdsAI = false;
  readonly range: number;
  angle: number;
  private remaining: number;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    private readonly w: LanceUnitWeapon,
    readonly target: Unit,
  ) {
    this.range = w.range;
    this.remaining = w.charge;
    this.angle = Math.atan2(target.y - u.y, target.x - u.x);
  }

  get sightLine(): SightLine {
    return this;
  }

  get locked(): boolean {
    return this.remaining <= this.w.lock;
  }

  step(dt: number): boolean {
    const { u, w, target } = this;
    if (!target.alive) return true;
    this.remaining -= dt;
    if (this.remaining > w.lock) this.angle = aimAhead(u.x, u.y, target, this.remaining, w.lead);
    if (this.remaining > 0) return false;
    lineStrike(this.world, u, this.angle, { range: w.range, width: w.width, dmg: w.dmg, lineWidth: 4 }, armyHit(u, w), unitTone(u));
    return true;
  }
}
