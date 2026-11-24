import { segmentDistance, wrapAngle } from '../core/math';
import type { FlyingShot, Hit, Homing, Team, Tone, Unit } from './entities';
import type { World } from './World';

/**
 * Attack shapes shared by the ace's weapons and the AI's: an arc slash, an instant line,
 * a fanned salvo and a launched shot. Each hits units not on the attacker's team.
 */

/** Who is attacking: where from, and which team it spares. */
export interface Attacker {
  readonly x: number;
  readonly y: number;
  readonly team: Team;
}

/** Largest unit radius a line query must reach (the biggest class is about 20 across). */
const MAX_UNIT_RADIUS = 12;

export interface ArcSpec {
  /** Reach from the attacker. */
  readonly reach: number;
  /** Half the arc's angle (radians). */
  readonly half: number;
  /** Anything this close is hit wherever it is. */
  readonly closeRange: number;
  readonly dmg: number;
}

/** A saber slash: hits every hostile unit within reach in the arc around `angle`, plus anything touching. */
export function arcSlash(world: World, a: Attacker, angle: number, s: ArcSpec, hit: Hit, tone: Tone): void {
  world.grid.eachNear(a.x, a.y, s.reach + 20, (u) => {
    if (u.team === a.team || !u.alive) return;
    const dx = u.x - a.x;
    const dy = u.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > s.reach + u.size * 0.5) return;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) <= s.half || d < s.closeRange) world.combat.damage(u, s.dmg, hit);
  });
  world.addFx({ type: 'slash', x: a.x, y: a.y, a: angle, half: s.half, r: s.reach, t: 0, life: 0.22, tone });
}

export interface LineSpec {
  readonly range: number;
  /** Extra hit width on each side of the line. */
  readonly width: number;
  readonly dmg: number;
  /** Peak width of the drawn line. */
  readonly lineWidth: number;
}

/**
 * An instant beam (Railgun, Beam lance): hits every hostile unit on the line out to full range at
 * once. Only the grid cells along the line are searched.
 */
export function lineStrike(world: World, a: Attacker, angle: number, s: LineSpec, hit: Hit, tone: Tone): void {
  const x2 = a.x + Math.cos(angle) * s.range;
  const y2 = a.y + Math.sin(angle) * s.range;
  world.grid.forEachNearSegment(a.x, a.y, x2, y2, s.width + MAX_UNIT_RADIUS, (u) => {
    if (u.team === a.team || !u.alive) return;
    if (segmentDistance(u.x, u.y, a.x, a.y, x2, y2) < u.size * 0.5 + s.width) world.combat.damage(u, s.dmg, hit);
  });
  world.addFx({ type: 'rail', x: a.x, y: a.y, x2, y2, t: 0, life: 0.3, tone, width: s.lineWidth });
}

/** Angle offset of shot `i` of `n` spread evenly across `fan` radians (0 for a single shot). */
export function fanOffset(i: number, n: number, fan: number): number {
  return n > 1 ? (i / (n - 1) - 0.5) * fan : 0;
}

/** What differs between shots; launchShot fills in velocity, team, the hit fields and bookkeeping. */
export interface ShotSpec {
  readonly kind: FlyingShot['kind'];
  /** Launch speed. */
  readonly speed: number;
  /** Top speed (homing shots accelerate to it); defaults to `speed`. */
  readonly maxSpeed?: number;
  readonly dmg: number;
  readonly life: number;
  readonly r: number;
  readonly pierce?: number;
  readonly splash?: number;
  readonly splashDmg?: number;
  readonly homing?: Homing | null;
  readonly target?: Unit | null;
}

/** Launches a flying shot from (x, y) along `angle`. The one place a FlyingShot is put together. */
export function launchShot(world: World, team: Team, x: number, y: number, angle: number, hit: Hit, s: ShotSpec): void {
  world.addShot({
    kind: s.kind,
    x,
    y,
    vx: Math.cos(angle) * s.speed,
    vy: Math.sin(angle) * s.speed,
    team,
    dmg: s.dmg,
    life: s.life,
    r: s.r,
    pierce: s.pierce ?? 0,
    hits: null,
    splash: s.splash ?? 0,
    splashDmg: s.splashDmg ?? 0,
    homing: s.homing ?? null,
    target: s.target ?? null,
    maxSpeed: s.maxSpeed ?? s.speed,
    src: hit.src,
    wid: hit.wid,
    dtype: hit.dtype,
    semiAce: hit.semiAce,
  });
}
