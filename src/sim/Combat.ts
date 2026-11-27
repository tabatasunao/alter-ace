import { DAMAGE_RULES, type DamageRule } from './damageRules';
import { scoreDeath, spawnWreck } from './deaths';
import { noteBlockedHit } from './dodge';
import { canBeHit, toneOf, type Hit, type Team, type Unit } from './entities';
import { kick } from './impact';
import type { World } from './World';

/**
 * Applies hits: runs the unit's damage rules (src/sim/damageRules.ts), takes the HP, and on death
 * leaves a wreck and scores it (src/sim/deaths.ts). Also blasts, which are many hits at once.
 */
export class Combat {
  constructor(private readonly world: World) {}

  /** Applies a hit through the unit's damage rules. Returns the damage dealt after them (0 when blocked). */
  damage(u: Unit, amount: number, hit: Hit): number {
    if (!canBeHit(u)) {
      noteBlockedHit(this.world, u);
      return 0;
    }
    for (const rule of DAMAGE_RULES[u.kind] as readonly DamageRule[]) {
      const next = rule(u, amount, hit, this.world);
      if (next === null) return 0;
      amount = next;
    }
    u.hp -= amount;
    u.flash = 0.08;
    if (u.hp <= 0) this.kill(u, hit);
    return amount;
  }

  kill(u: Unit, hit: Hit): void {
    u.alive = false;
    spawnWreck(this.world, u);
    scoreDeath(this.world, u, hit);
  }

  /**
   * Damages every unit not on `team` within `radius`, falling off to half at the edge. A big blast
   * opens with a flash and shakes the screen when it goes off near the ace.
   */
  explode(x: number, y: number, radius: number, dmg: number, team: Team, hit: Hit): void {
    const world = this.world;
    world.grid.eachNear(x, y, radius + 20, (u) => {
      if (u.team === team || !u.alive) return;
      const d = Math.hypot(u.x - x, u.y - y) - u.size * 0.5;
      if (d > radius) return;
      this.damage(u, dmg * (1 - (0.5 * Math.max(0, d)) / radius), hit);
    });
    const tone = toneOf(team, hit.src, hit.semiAce);
    const blast = world.catalog.battle.impact.blast;
    if (radius >= blast.minRadius) {
      world.addFx({ type: 'flare', x, y, r: radius * 0.45, t: 0, life: 0.1, tone });
      const P = world.player;
      if (P?.alive) {
        const d = Math.hypot(P.x - x, P.y - y);
        if (d < blast.range) kick(world, blast, 1 - d / blast.range);
      }
    }
    world.addFx({ type: 'boom', x, y, r: radius, t: 0, life: 0.35, tone });
  }
}
