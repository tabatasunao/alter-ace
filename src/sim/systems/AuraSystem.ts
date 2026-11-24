import type { System } from '../System';
import type { World } from '../World';

/** Units with an aura (Commanders) buff the fire rate of nearby AI teammates. */
export class AuraSystem implements System {
  update(world: World): void {
    const buffTime = world.catalog.battle.ai.auraBuffTime;
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.def.aura) continue;
      const { radius, fireRateMul } = u.def.aura;
      const r2 = radius * radius;
      world.grid.eachNear(u.x, u.y, radius, (v) => {
        if (v.team !== u.team || v === u || v.kind !== 'soldier') return;
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        if (dx * dx + dy * dy < r2) {
          v.buffT = buffTime;
          v.buffMul = fireRateMul;
        }
      });
    }
  }
}
