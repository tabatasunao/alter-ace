import type { SaberWeapon } from '../../../data/types';
import { arcSlash } from '../../attacks';
import { aceHit } from '../../entities';
import type { WeaponBehavior } from '../WeaponBehavior';

/**
 * Lunges at the target, then slashes an arc when the lunge ends (Beam Saber). Uses no ammo.
 * Firing starts the lunge (PlayerMovementSystem carries it) and grants brief invulnerability.
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
      onArrive: () => arcSlash(world, P, angle, spec, aceHit(w), 'ace'),
    };
    P.iframes = Math.max(P.iframes, w.iframes);
    return 0;
  },
  // Fireworks for a blade: one full-circle slash around the ace.
  burst({ world, player: P, weapon: w }) {
    arcSlash(world, P, 0, { reach: w.slash, half: Math.PI, closeRange: w.closeRange, dmg: w.dmg }, aceHit(w), 'ace');
  },
};
