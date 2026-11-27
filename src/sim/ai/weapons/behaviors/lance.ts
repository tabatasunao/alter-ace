import type { LanceUnitWeapon } from '../../../../data/types';
import { aceChargeDelay } from '../../aceCharges';
import { aimAhead } from '../../aim';
import { lineStrike } from '../../../attacks';
import { armyHit, unitTone, type SightLine, type Soldier, type Unit, type UnitAction } from '../../../entities';
import type { World } from '../../../World';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

/**
 * A charged beam (Beam lance, mega-beam). Firing starts the charge; the beam fires when it ends.
 * A charge at the ace needs a turn (src/sim/ai/aceCharges.ts): without one the unit holds fire,
 * and with one the charge may run longer so attacks on the ace stay spaced out.
 */
export const lance: UnitWeaponBehavior<LanceUnitWeapon> = {
  fire({ world, unit, weapon, target }) {
    const delay = aceChargeDelay(world, unit, target, weapon.charge);
    if (delay === null) return false;
    unit.action = new LanceCharge(world, unit, weapon, target, weapon.charge + delay);
    return true;
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
  readonly width: number;
  angle: number;
  private remaining: number;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    private readonly w: LanceUnitWeapon,
    readonly target: Unit,
    charge: number,
  ) {
    this.range = w.range;
    this.width = w.width;
    this.remaining = charge;
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
    lineStrike(this.world, u, this.angle, { range: w.range, width: w.width, dmg: w.dmg, lineWidth: Math.max(4, w.width * 0.8), look: w.look }, armyHit(u, w), unitTone(u));
    return true;
  }
}
