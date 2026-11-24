import { ENEMY, isSemiAce, type Soldier } from '../entities';
import { activePlayer, type System } from '../System';
import type { World } from '../World';

/**
 * Enemy semi-aces (hunters leashed to the ace, `nearAce`) find the ace when it comes within the
 * hunters' notice range (`balance.aceHuntRange`). From then on they stalk it: they target it at any
 * distance and keep within their leash of it. A semi-ace with `rally` also gathers a pack of the
 * nearest enemy units, which hunt the ace with it until it dies, then go back to their army.
 */
export class StalkSystem implements System {
  update(world: World): void {
    for (const u of world.units) {
      if (u.kind === 'soldier' && u.leader && !u.leader.alive) {
        u.leader = null;
        u.stalking = false;
      }
    }
    const P = activePlayer(world);
    if (!P) return;
    const range = world.catalog.battle.balance.aceHuntRange;
    const r2 = range * range;
    for (const u of world.units) {
      if (u.kind !== 'soldier' || u.stalking || !u.alive || u.team !== ENEMY || !u.hunter || !u.def.nearAce) continue;
      const dx = P.x - u.x;
      const dy = P.y - u.y;
      if (dx * dx + dy * dy >= r2) continue;
      u.stalking = true;
      this.rally(world, u);
    }
  }

  /** The leader gathers the nearest free teammates within its rally radius into its pack. */
  private rally(world: World, leader: Soldier): void {
    const r = leader.def.rally;
    if (!r) return;
    const want = r.min + Math.floor(world.random.next() * (r.max - r.min + 1));
    const r2 = r.radius * r.radius;
    const candidates: { u: Soldier; d: number }[] = [];
    world.grid.eachNear(leader.x, leader.y, r.radius, (v) => {
      if (v.kind !== 'soldier' || v === leader || v.team !== leader.team || !v.alive || v.leader || isSemiAce(v)) return;
      const d = (v.x - leader.x) ** 2 + (v.y - leader.y) ** 2;
      if (d <= r2) candidates.push({ u: v, d });
    });
    candidates.sort((a, b) => a.d - b.d);
    const pack = candidates.slice(0, want);
    for (const { u } of pack) {
      u.leader = leader;
      u.stalking = true;
      u.retarget = 0;
    }
    const who = `Enemy ${leader.def.name}`;
    world.banner(pack.length ? `${who} and ${pack.length} ALTERs are hunting you` : `${who} is hunting you`, 'warn');
  }
}
