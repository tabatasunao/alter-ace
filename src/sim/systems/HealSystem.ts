import { unitTone } from '../entities';
import type { System } from '../System';
import type { World } from '../World';

/** Heal pulse duration, seconds (visual only). */
const PULSE_LIFE = 0.6;

/**
 * Heal pulses (classes with `heal`): every `interval` seconds, units of the healer's army within
 * `radius` regain `amount` of their max HP, up to full. The ace is on the allied team, so allied
 * healers heal it too. A stunned healer's timer pauses.
 */
export class HealSystem implements System {
  update(world: World, dt: number): void {
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.alive || !u.def.heal || u.stunT > 0) continue;
      u.healT -= dt;
      if (u.healT > 0) continue;
      const { interval, radius, amount } = u.def.heal;
      u.healT += interval;
      world.grid.eachNear(u.x, u.y, radius, (v) => {
        if (v.team !== u.team || !v.alive || v.kind === 'decoy') return;
        if (Math.hypot(v.x - u.x, v.y - u.y) > radius + v.size * 0.5) return;
        v.hp = Math.min(v.maxHp, v.hp + v.maxHp * amount);
      });
      world.addFx({ type: 'pulse', x: u.x, y: u.y, r: radius, t: 0, life: PULSE_LIFE, tone: unitTone(u) });
    }
  }
}
