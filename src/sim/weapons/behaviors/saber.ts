import type { SaberWeapon } from '../../../data/types';
import { arcSlash } from '../../attacks';
import { clash, swingingBlade } from '../../clash';
import { aceHit } from '../../entities';
import { kick } from '../../impact';
import type { WeaponBehavior } from '../WeaponBehavior';

/**
 * Lunges at the target, then slashes an arc when the lunge ends (Beam Saber). Uses no ammo.
 * Firing starts the lunge (PlayerMovementSystem carries it) with a flash and brief invulnerability;
 * a slash that connects lands with hit-stop. An enemy mid-swing with its own saber clashes instead
 * of being cut.
 */
export const saber: WeaponBehavior<SaberWeapon> = {
  fire({ world, player: P, weapon: w, targets, angle }) {
    const t = targets[0]!;
    const distance = Math.hypot(t.x - P.x, t.y - P.y);
    const go = Math.max(0, distance - w.stopDistance);
    const duration = w.lungeDuration;
    const spec = { reach: w.slash, half: w.arcHalfAngle, closeRange: w.closeRange, dmg: w.dmg };
    P.lunge = {
      remaining: duration,
      vx: (Math.cos(angle) * go) / duration,
      vy: (Math.sin(angle) * go) / duration,
      onArrive: () => {
        const parry = (u: Parameters<typeof swingingBlade>[0]) => {
          if (!swingingBlade(u)) return false;
          clash(world, P, u);
          return true;
        };
        if (arcSlash(world, P, angle, spec, aceHit(w), 'ace', parry) > 0) kick(world, world.catalog.battle.impact.slash);
      },
    };
    P.iframes = Math.max(P.iframes, w.iframes);
    world.addFx({ type: 'flare', x: P.x, y: P.y, r: 12, t: 0, life: 0.08, tone: 'accent' });
    return 0;
  },
  // Fireworks for a blade: one full-circle slash around the ace.
  burst({ world, player: P, weapon: w }) {
    arcSlash(world, P, 0, { reach: w.slash, half: Math.PI, closeRange: w.closeRange, dmg: w.dmg }, aceHit(w), 'ace');
  },
};
