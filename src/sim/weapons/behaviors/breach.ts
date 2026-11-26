import type { BreachWeapon } from '../../../data/types';
import { knockBack } from '../../ai/knockback';
import { aceHit, type Player } from '../../entities';
import type { World } from '../../World';
import { firePlayerShot, spreadAngle } from '../playerShot';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** The release burst's blast reaches this much farther than a normal blast, all around the ace. */
const BURST_BLAST_REACH = 1.3;

/**
 * A blast centered at (cx, cy): damage falling off to half at the edge (the weapon's damage
 * type), and every hostile unit in it thrown away from the ace.
 */
function blastAt(world: World, P: Player, w: BreachWeapon, cx: number, cy: number, radius: number): void {
  world.combat.explode(cx, cy, radius, w.blast.dmg, P.team, aceHit(w));
  world.grid.eachNear(cx, cy, radius + 20, (u) => {
    if (u.team === P.team || !u.alive || u.kind !== 'soldier') return;
    if (Math.hypot(u.x - cx, u.y - cy) - u.size * 0.5 > radius) return;
    const d = Math.hypot(u.x - P.x, u.y - P.y) || 1;
    knockBack(world, u, ((u.x - P.x) / d) * w.blast.push, ((u.y - P.y) / d) * w.blast.push, w.blast.pushTime);
  });
}

/**
 * Pellets every shot, and every `blastEvery`-th shot of a magazine a point-blank blast in front
 * that throws enemies back and kicks the ace the other way (Breach Cannon).
 */
export const breach: WeaponBehavior<BreachWeapon> = {
  roundsPerShot: (w) => w.pellets,
  fire({ world, player: P, weapon: w, angle, ammo }) {
    for (let i = 0; i < w.pellets; i++) firePlayerShot(world, P, w, spreadAngle(world, angle, w.spread), { jitter: w.speedJitter });
    const shot = (w.mag ?? 0) - ammo + 1;
    if (shot % w.blastEvery === 0) {
      blastAt(world, P, w, P.x + Math.cos(angle) * w.blast.offset, P.y + Math.sin(angle) * w.blast.offset, w.blast.radius);
      P.vx -= Math.cos(angle) * w.recoil;
      P.vy -= Math.sin(angle) * w.recoil;
    }
    return 1;
  },
  // Fireworks for a breacher: pellets everywhere and one blast all around the ace.
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) firePlayerShot(world, P, w, burstAngle(ctx), { jitter: Math.max(w.speedJitter, 0.35) });
    blastAt(world, P, w, P.x, P.y, w.blast.radius * BURST_BLAST_REACH);
  },
};
