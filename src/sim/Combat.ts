import { DAMAGE_RULES, type DamageRule } from './damageRules';
import { scoreDeath, spawnWreck } from './deaths';
import { canBeHit, toneOf, type Hit, type Team, type Unit } from './entities';
import type { World } from './World';

/**
 * Applies hits: runs the unit's damage rules (src/sim/damageRules.ts), takes the HP, and on death
 * leaves a wreck and scores it (src/sim/deaths.ts). Also blasts, which are many hits at once.
 */
export class Combat {
  constructor(private readonly world: World) {}

  damage(u: Unit, amount: number, hit: Hit): void {
    if (!canBeHit(u)) return;
    for (const rule of DAMAGE_RULES[u.kind] as readonly DamageRule[]) {
      const next = rule(u, amount, hit, this.world);
      if (next === null) return;
      amount = next;
    }
    u.hp -= amount;
    u.flash = 0.08;
    if (u.hp <= 0) this.kill(u, hit);
  }

  kill(u: Unit, hit: Hit): void {
    u.alive = false;
    spawnWreck(this.world, u);
    scoreDeath(this.world, u, hit);
  }

  /** Damages every unit not on `team` within `radius`, falling off to half at the edge. */
  explode(x: number, y: number, radius: number, dmg: number, team: Team, hit: Hit): void {
    this.world.grid.eachNear(x, y, radius + 20, (u) => {
      if (u.team === team || !u.alive) return;
      const d = Math.hypot(u.x - x, u.y - y) - u.size * 0.5;
      if (d > radius) return;
      this.damage(u, dmg * (1 - (0.5 * Math.max(0, d)) / radius), hit);
    });
    this.world.addFx({ type: 'boom', x, y, r: radius, t: 0, life: 0.35, tone: toneOf(team, hit.src, hit.semiAce) });
  }
}
