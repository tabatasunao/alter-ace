import { clamp } from '../../../../core/math';
import type { SaberUnitWeapon } from '../../../../data/types';
import { aceChargeDelay } from '../../aceCharges';
import { arcSlash } from '../../../attacks';
import { clash, holdsBlade } from '../../../clash';
import { armyHit, unitTone, type SightLine, type Soldier, type Unit, type UnitAction } from '../../../entities';
import type { World } from '../../../World';
import { moveUnit } from '../../unitMotion';
import type { UnitWeaponBehavior } from '../UnitWeaponBehavior';

type SaberDash = NonNullable<SaberUnitWeapon['dash']>;

/**
 * A semi-ace's beam saber. Within `range` it lunges at the target and slashes on arrival. With
 * `dash`, a target farther out (up to `dash.range`) gets a dash strike: a wind-up that shows the
 * dash line, then a long dash that ends in a harder slash. With `retreat`, every slash is followed
 * by a quick hop back.
 */
export const saber: UnitWeaponBehavior<SaberUnitWeapon> = {
  reach: (w) => Math.max(w.range, w.dash?.range ?? 0),
  fire({ world, unit: u, weapon: w, target }) {
    const d = Math.hypot(target.x - u.x, target.y - u.y);
    if (d <= w.range) {
      const angle = Math.atan2(target.y - u.y, target.x - u.x);
      u.action = lunge(world, u, w, angle, d, { speed: w.lungeSpeed, maxTime: w.maxLunge, dmg: w.dmg, trail: false });
      return true;
    }
    const dash = w.dash;
    if (!dash || u.skillCd > 0 || d > dash.range) return false;
    // A dash strike at the ace is a charged attack: it needs a turn.
    const delay = aceChargeDelay(world, u, target, dash.windup);
    if (delay === null) return false;
    u.skillCd = dash.cooldown;
    u.action = new DashWindup(world, u, w, dash, target, dash.windup + delay);
    return true;
  },
};

/** How a lunge moves and hits: speed, longest duration, slash damage, and whether it leaves a trail. */
interface LungeMove {
  readonly speed: number;
  readonly maxTime: number;
  readonly dmg: number;
  readonly trail: boolean;
}

/**
 * A straight dash along `angle` that stops `stopDistance` short of `distance` and slashes there. The
 * ace, if it has its own saber out, clashes with the slash instead of taking it. With `retreat`, a
 * hop back follows.
 */
function lunge(world: World, u: Soldier, w: SaberUnitWeapon, angle: number, distance: number, move: LungeMove): UnitAction {
  const go = Math.max(0, distance - w.stopDistance);
  const time = clamp(go / move.speed, 1 / 60, move.maxTime);
  const x0 = u.x;
  const y0 = u.y;
  return new Glide(world, u, angle, go, time, true, () => {
    const tone = unitTone(u);
    if (move.trail) world.addFx({ type: 'line', x: x0, y: y0, x2: u.x, y2: u.y, tone, width: u.size * 0.5, t: 0, life: 0.3 });
    const parry = (t: Unit) => {
      if (t.kind !== 'player' || !holdsBlade(t)) return false;
      clash(world, t, u);
      return true;
    };
    arcSlash(world, u, angle, { reach: w.slash, half: w.arcHalfAngle, closeRange: w.closeRange, dmg: move.dmg }, armyHit(u, w), tone, parry);
    const r = w.retreat;
    return r ? new Glide(world, u, angle + Math.PI, r.distance, r.time, false) : null;
  });
}

/**
 * Moves the unit `distance` along `angle` in `time` seconds, holding its AI, then runs `onArrive`,
 * which may return a follow-up action. The follow-up starts only if nothing else took over the
 * unit on arrival (a clash knocks it back instead).
 */
class Glide implements UnitAction {
  readonly holdsAI = true;
  readonly sightLine = null;
  private remaining: number;
  private readonly vx: number;
  private readonly vy: number;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    angle: number,
    distance: number,
    time: number,
    readonly blade: boolean,
    private readonly onArrive?: () => UnitAction | null,
  ) {
    this.remaining = time;
    this.vx = (Math.cos(angle) * distance) / time;
    this.vy = (Math.sin(angle) * distance) / time;
  }

  step(dt: number): boolean {
    // The last step covers only what is left, so the move ends exactly `distance` away.
    moveUnit(this.world, this.u, this.vx, this.vy, Math.min(dt, this.remaining));
    this.remaining -= dt;
    if (this.remaining > 0) return false;
    this.u.vx = this.u.vy = 0;
    const next = this.onArrive?.() ?? null;
    if (next && this.u.action === this) this.u.action = next;
    return true;
  }
}

/**
 * The unit stands still while a sight line tracks the target, then freezes for the last `lock`
 * seconds (the cue to dodge). When it ends, the unit lunges to where the line pointed. A dead
 * target cancels it.
 */
class DashWindup implements UnitAction, SightLine {
  readonly holdsAI = true;
  readonly width: number;
  angle = 0;
  range = 0;
  private remaining: number;

  constructor(
    private readonly world: World,
    private readonly u: Soldier,
    private readonly w: SaberUnitWeapon,
    private readonly dash: SaberDash,
    readonly target: Unit,
    windup: number,
  ) {
    this.width = w.slash / 2;
    this.remaining = windup;
    this.track();
  }

  get sightLine(): SightLine {
    return this;
  }

  get locked(): boolean {
    return this.remaining <= this.dash.lock;
  }

  step(dt: number): boolean {
    const { u, w, dash } = this;
    if (!this.target.alive) return true;
    u.vx = u.vy = 0;
    this.remaining -= dt;
    if (!this.locked) this.track();
    if (this.remaining > 0) return false;
    u.action = lunge(this.world, u, w, this.angle, this.range, { speed: dash.speed, maxTime: dash.range / dash.speed, dmg: dash.dmg, trail: true });
    return true;
  }

  /** Points the line at the target, up to the dash's reach. */
  private track(): void {
    const { u, target } = this;
    this.angle = Math.atan2(target.y - u.y, target.x - u.x);
    this.range = Math.min(this.dash.range, Math.hypot(target.x - u.x, target.y - u.y));
  }
}
