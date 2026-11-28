import type { FlyingShot } from '../entities';
import { noteGraze } from '../graze';
import { activePlayer, type System } from '../System';
import type { World } from '../World';

/**
 * Near misses by enemy shots. A flying shot that comes within the graze radius of the ace's hull
 * and then leaves it without touching the ace counts once (src/sim/graze.ts). A shot that touches
 * the ace (a hit, or a close dodge during a dash) never counts. Runs after ProjectileSystem.
 * Built per battle, so its tracking starts fresh.
 */
export class GrazeSystem implements System {
  /** Shots inside the graze zone, with the closest they came to the hull. */
  private readonly near = new Map<FlyingShot, number>();
  /** Shots that touched the ace. */
  private readonly touched = new WeakSet<FlyingShot>();

  update(world: World): void {
    const P = activePlayer(world);
    if (!P) return;
    const radius = world.catalog.battle.player.superRelease.charge.graze.radius;
    const live = this.near.size > 0 ? new Set(world.shots) : null;
    for (const p of world.shots) {
      if (p.kind === 'mortar' || p.team === P.team || this.touched.has(p)) continue;
      const edge = Math.hypot(p.x - P.x, p.y - P.y) - P.size * 0.5 - p.r;
      if (edge <= 0 || p.hits?.includes(P.id)) {
        this.touched.add(p);
        this.near.delete(p);
      } else if (edge <= radius) {
        this.near.set(p, Math.min(edge, this.near.get(p) ?? Infinity));
      } else if (this.near.has(p)) {
        noteGraze(world, P, this.near.get(p)!, 'shot');
        this.near.delete(p);
      }
    }
    // A shot that ran out of life inside the zone passed by; one that vanished on the ace was touched above.
    if (live) {
      for (const [p, edge] of this.near) {
        if (live.has(p)) continue;
        this.near.delete(p);
        if (p.life <= 0) noteGraze(world, P, edge, 'shot');
      }
    }
  }
}
