import type { System } from '../System';
import type { World } from '../World';

/** Runs semi-ace shield timers. A stun (EMP) drops a raised shield. Combat raises it on a hit. */
export class ShieldSystem implements System {
  update(world: World, dt: number): void {
    for (const u of world.units) {
      if (u.kind !== 'soldier' || !u.def.shield) continue;
      if (u.shieldCd > 0) u.shieldCd -= dt;
      if (u.shieldT > 0) u.shieldT = u.stunT > 0 ? 0 : u.shieldT - dt;
    }
  }
}
