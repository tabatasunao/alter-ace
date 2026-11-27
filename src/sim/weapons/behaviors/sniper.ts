import type { SniperWeapon } from '../../../data/types';
import { soldiersOnLine } from '../../attacks';
import { aceHit, type Player, type Soldier } from '../../entities';
import type { World } from '../../World';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** Seconds a sniper beam stays on screen. */
const BEAM_LIFE = 0.45;
/** Damage left over below this carries no further. */
const MIN_CARRY = 1;

/**
 * A beam from the ace along `angle`, starting at `first` (enemies in front of it are passed by).
 * It deals full damage to `first`; when a hit kills, the damage left over carries on to the next
 * enemy on the line, and so on. Drawn to the last enemy hit, or to full range when `first` is null.
 */
function strike(world: World, P: Player, w: SniperWeapon, angle: number, first: Soldier | null): void {
  let x2 = P.x + Math.cos(angle) * w.range;
  let y2 = P.y + Math.sin(angle) * w.range;
  if (first) {
    const line = soldiersOnLine(world, P, angle, w.range);
    const start = line.indexOf(first);
    const queue = start >= 0 ? line.slice(start) : [first, ...line.filter((u) => Math.hypot(u.x - P.x, u.y - P.y) > Math.hypot(first.x - P.x, first.y - P.y))];
    let dmg = w.dmg;
    for (const u of queue) {
      if (!u.alive) continue;
      const before = u.hp;
      const dealt = world.combat.damage(u, dmg, aceHit(w));
      x2 = u.x;
      y2 = u.y;
      if (u.alive || dealt <= 0) break;
      dmg *= (dealt - before) / dealt;
      if (dmg < MIN_CARRY) break;
    }
  }
  world.addFx({ type: 'heavyBeam', x: P.x, y: P.y, x2, y2, t: 0, life: BEAM_LIFE, tone: 'ace', width: w.beamWidth });
}

/**
 * One target, one huge hit (Sniper Rifle): an instant beam at the top-ranked target that punches on
 * through whatever it kills. The sight line shown before each shot is drawn from the cooldown
 * (PlayerLayer); nothing in the sim waits for it.
 */
export const sniper: WeaponBehavior<SniperWeapon> = {
  fire({ world, player: P, weapon: w, targets }) {
    const t = targets[0]!;
    strike(world, P, w, Math.atan2(t.y - P.y, t.x - P.x), t);
    return 1;
  },
  // Beams in random directions in front, each starting at the first enemy on its line.
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) {
      const a = burstAngle(ctx);
      strike(world, P, w, a, soldiersOnLine(world, P, a, w.range)[0] ?? null);
    }
  },
};
