import { clamp, TAU, wrapAngle } from '../../core/math';
import {
  canBeHit,
  toneOf,
  type FlyingShot,
  type LobbedShot,
  type Projectile,
  type ProjectileKind,
  type ShotOfKind,
  type Unit,
} from '../entities';
import { aimAhead } from '../ai/aim';
import { knockBack } from '../ai/knockback';
import { stunBlast } from '../attacks';
import { noteBlockedHit } from '../dodge';
import type { World } from '../World';

const OUT_OF_BOUNDS = 60;
const HIT_SEARCH_PAD = 14;

/**
 * How one kind of projectile moves and resolves each step.
 * To add a projectile kind: add it to the Projectile union, implement this, register it below,
 * and add a painter in src/render/painters/shotPainters.ts.
 */
export interface ProjectileMotion<P extends Projectile = Projectile> {
  /** Advances the projectile; returns true when it is spent and should be removed. */
  step(p: P, dt: number, world: World): boolean;
}

/** Straight (or homing) flight with swept collision, pierce and splash. */
export const flying: ProjectileMotion<FlyingShot> = {
  step(p, dt, world) {
    if (p.homing) steer(p, dt, world);
    const ox = p.x;
    const oy = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    const u = firstHit(world, p, ox, oy);
    if (u) {
      world.combat.damage(u, p.dmg, p);
      if (p.knock && u.kind === 'soldier' && u.alive) {
        const v = Math.hypot(p.vx, p.vy) || 1;
        knockBack(world, u, (p.vx / v) * p.knock.push, (p.vy / v) * p.knock.push, p.knock.time);
      }
      if (p.splash) {
        world.combat.explode(p.x, p.y, p.splash, p.splashDmg, p.team, p);
        return true;
      }
      if (p.pierce > 0) {
        p.pierce--;
        (p.hits ??= []).push(u.id);
        return false;
      }
      world.addFx({ type: 'spark', x: p.x, y: p.y, t: 0, life: 0.12, tone: toneOf(p.team, p.src, p.semiAce) });
      return true;
    }
    const outside =
      p.x < -OUT_OF_BOUNDS || p.x > world.width + OUT_OF_BOUNDS || p.y < -OUT_OF_BOUNDS || p.y > world.height + OUT_OF_BOUNDS;
    if (p.life <= 0 || outside) {
      if (p.splash) world.combat.explode(p.x, p.y, p.splash, p.splashDmg, p.team, p);
      return true;
    }
    return false;
  },
};

/**
 * Arcs to its landing point and explodes after its flight time. Keeps x, y on its current ground
 * point. A shell with a target steers its landing point toward where the target will be.
 */
export const lobbed: ProjectileMotion<LobbedShot> = {
  step(p, dt, world) {
    p.t += dt;
    const tgt = p.target;
    if (tgt && tgt.alive && p.track > 0) {
      const left = Math.max(0, p.flight - p.t);
      const ax = clamp(tgt.x + tgt.vx * left * p.lead, 0, world.width);
      const ay = clamp(tgt.y + tgt.vy * left * p.lead, 0, world.height);
      const dx = ax - p.tx;
      const dy = ay - p.ty;
      const d = Math.hypot(dx, dy);
      const step = p.track * dt;
      if (d <= step) {
        p.tx = ax;
        p.ty = ay;
      } else {
        p.tx += (dx / d) * step;
        p.ty += (dy / d) * step;
      }
    }
    const k = Math.min(1, p.t / p.flight);
    p.x = p.sx + (p.tx - p.sx) * k;
    p.y = p.sy + (p.ty - p.sy) * k;
    if (p.t < p.flight) return false;
    world.combat.explode(p.tx, p.ty, p.splash, p.splashDmg, p.team, p);
    if (p.stun) stunBlast(world, p.tx, p.ty, p.stun, p.team);
    return true;
  },
};

type MotionRegistry = { readonly [K in ProjectileKind]: ProjectileMotion<ShotOfKind<K>> };

const PROJECTILE_MOTIONS: MotionRegistry = {
  bullet: flying,
  beam: flying,
  missile: flying,
  shell: flying,
  mortar: lobbed,
};

export function motionFor(p: Projectile): ProjectileMotion {
  return PROJECTILE_MOTIONS[p.kind] as ProjectileMotion;
}

function steer(p: FlyingShot, dt: number, world: World): void {
  const h = p.homing!;
  if (h.armAt !== undefined && p.life > h.armAt) return; // still in its launch phase
  if (h.terminalLeft !== undefined && h.terminalLeft <= 0) return; // committed: flies straight on
  const prefer = h.prefer;
  if (prefer && prefer.alive && p.target !== prefer && h.terminalLeft === undefined && (prefer.x - p.x) ** 2 + (prefer.y - p.y) ** 2 <= h.retargetRadius * h.retargetRadius) {
    p.target = prefer;
  }
  if (!p.target || !p.target.alive) {
    p.target = h.spread ? randomHostileNear(world, p, h.retargetRadius) : world.grid.nearestHostile(p.x, p.y, p.team, h.retargetRadius);
  }
  if (!p.target) return;
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  let want = Math.atan2(dy, dx);
  let turnRate = h.turnRate;
  let weave = true;
  if (h.terminal) {
    // Terminal correction: one hard turn at the target when it first comes within range, then straight on.
    if (h.terminalLeft === undefined && dx * dx + dy * dy < h.terminal.range * h.terminal.range) h.terminalLeft = h.terminal.time;
    if (h.terminalLeft !== undefined) {
      h.terminalLeft -= dt;
      turnRate = h.terminal.turnRate;
      weave = false;
      // Aimed where the target is heading: a steady mover is hit, a change of course slips the line.
      const flight = Math.hypot(dx, dy) / Math.max(1, Math.hypot(p.vx, p.vy));
      want = aimAhead(p.x, p.y, p.target, flight, h.terminal.lead);
    }
  }
  // Weaving swarm: a sine swing around the pursuit line, clocked by the missile's remaining life.
  if (h.weave && weave) want += h.weave.amplitude * Math.sin(h.weave.phase + p.life * h.weave.frequency * TAU);
  let heading = Math.atan2(p.vy, p.vx);
  const turn = turnRate * dt;
  heading += clamp(wrapAngle(want - heading), -turn, turn);
  const speed = Math.min(p.maxSpeed, Math.hypot(p.vx, p.vy) + h.acceleration * dt);
  p.vx = Math.cos(heading) * speed;
  p.vy = Math.sin(heading) * speed;
}

/** A random living hostile within `radius` of the shot, or null: spread-out retargeting. */
function randomHostileNear(world: World, p: FlyingShot, radius: number): Unit | null {
  const r2 = radius * radius;
  const candidates: Unit[] = [];
  world.grid.eachNear(p.x, p.y, radius, (u) => {
    if (u.team !== p.team && u.alive && (u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= r2) candidates.push(u);
  });
  return candidates.length ? candidates[Math.floor(world.random.next() * candidates.length)]! : null;
}

/**
 * The first hostile unit the shot's path from (ox, oy) touched this step. A shot passes through a
 * unit that cannot be hit, which may count as the ace's close dodge.
 */
function firstHit(world: World, p: FlyingShot, ox: number, oy: number): Unit | null {
  const sx = p.x - ox;
  const sy = p.y - oy;
  const l2 = sx * sx + sy * sy;
  let best: Unit | null = null;
  let bestT = 2;
  world.grid.forEachInBox(
    Math.min(ox, p.x) - HIT_SEARCH_PAD,
    Math.min(oy, p.y) - HIT_SEARCH_PAD,
    Math.max(ox, p.x) + HIT_SEARCH_PAD,
    Math.max(oy, p.y) + HIT_SEARCH_PAD,
    (u) => {
      if (u.team === p.team || !u.alive) return;
      if (p.hits && p.hits.includes(u.id)) return;
      const rad = u.size * 0.5 + p.r;
      let t = l2 ? ((u.x - ox) * sx + (u.y - oy) * sy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ox + sx * t - u.x;
      const dy = oy + sy * t - u.y;
      if (dx * dx + dy * dy > rad * rad) return;
      if (!canBeHit(u)) {
        noteBlockedHit(world, u);
        return;
      }
      if (t < bestT) {
        bestT = t;
        best = u;
      }
    },
  );
  return best;
}
