import { clamp } from '../../core/math';
import { leashHeading } from '../ai/leash';
import { chooseTarget } from '../ai/targetSelection';
import { unitBehaviorFor } from '../ai/weapons/registry';
import { ALLY, ENEMY, type Soldier } from '../entities';
import type { System } from '../System';
import type { World } from '../World';

/**
 * Every AI unit: pick a target now and then, close to ~82% of its weapon's range, kite (if the
 * class kites) or strafe, and fire its weapon when loaded. With no target, advance on the enemy army.
 * Leashed units (semi-aces near the ace, pack members near their leader) head back when they
 * stray too far, still firing.
 */
export class SoldierAISystem implements System {
  update(world: World, dt: number): void {
    for (const u of world.units) {
      if (u.alive && u.kind === 'soldier') this.think(world, u, dt);
    }
  }

  private think(world: World, u: Soldier, dt: number): void {
    if (u.flash > 0) u.flash -= dt;
    if (u.buffT > 0) u.buffT -= dt;
    if (u.stunT > 0) {
      u.stunT -= dt;
      u.vx = u.vy = 0;
      return;
    }
    if (u.action?.holdsAI) return; // UnitActionSystem moves it
    const c = u.def;
    const w = u.weapon;
    const ai = world.catalog.battle.ai;
    const random = world.random;

    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || !u.target.alive) {
      u.target = chooseTarget(world, u);
      u.retarget = random.range(ai.retargetMin, ai.retargetMax);
    }

    let mx = 0;
    let my = 0;
    const t = u.target;
    if (t) {
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (d > w.range * ai.approachFactor) {
        mx = nx;
        my = ny;
      } else if (c.kiteDistance && d < c.kiteDistance) {
        mx = -nx;
        my = -ny;
      } else {
        u.strafeT -= dt;
        if (u.strafeT <= 0) {
          u.strafe = u.strafe === 1 ? -1 : 1;
          u.strafeT = random.range(ai.strafeMin, ai.strafeMax);
        }
        mx = -ny * u.strafe * ai.strafeSpeed;
        my = nx * u.strafe * ai.strafeSpeed;
      }
      u.cd -= dt * (u.buffT > 0 ? u.buffMul : 1);
      if (u.cd <= 0 && d <= w.range && !u.action) {
        unitBehaviorFor(w).fire({ world, unit: u, weapon: w, target: t });
        u.cd = w.interval * random.range(1 - ai.fireIntervalJitter, 1 + ai.fireIntervalJitter);
      }
    } else {
      if (u.cd > 0) u.cd -= dt;
      const goal = world.centroids[u.team === ALLY ? ENEMY : ALLY];
      if (goal) {
        const dx = goal.x - u.x;
        const dy = goal.y - u.y;
        const d = Math.hypot(dx, dy) || 1;
        mx = dx / d;
        my = dy / d;
      }
    }

    const leash = leashHeading(world, u);
    if (leash) {
      mx = leash.x;
      my = leash.y;
    }

    const k = Math.min(1, dt * ai.steering);
    u.vx += (mx * c.speed - u.vx) * k;
    u.vy += (my * c.speed - u.vy) * k;
    u.x = clamp(u.x + u.vx * dt, ai.edgeMargin, world.width - ai.edgeMargin);
    u.y = clamp(u.y + u.vy * dt, ai.edgeMargin, world.height - ai.edgeMargin);
  }
}
