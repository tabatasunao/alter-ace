import { clamp } from '../../../core/math';
import type { MortarWeapon } from '../../../data/types';
import { aceHit } from '../../entities';
import { burstAngle, type WeaponBehavior } from '../WeaponBehavior';

/** Burst shells land at random this share of the mortar's range from the ace (nearest, farthest). */
const BURST_NEAR = 0.3;
const BURST_FAR = 0.8;

/** A lobbed shell aimed where the target is heading (Plasma Mortar). */
export const mortar: WeaponBehavior<MortarWeapon> = {
  fire({ world, player: P, weapon: w, targets }) {
    const t = targets[0]!;
    const lead = w.flight * w.leadFactor;
    world.addShot({
      kind: 'mortar',
      x: P.x,
      y: P.y,
      sx: P.x,
      sy: P.y,
      tx: clamp(t.x + t.vx * lead, 0, world.width),
      ty: clamp(t.y + t.vy * lead, 0, world.height),
      t: 0,
      flight: w.flight,
      splash: w.splash,
      splashDmg: w.splashDmg,
      team: P.team,
      ...aceHit(w),
    });
    return 1;
  },
  burst(ctx) {
    const { world, player: P, weapon: w } = ctx;
    for (let i = 0; i < ctx.count; i++) {
      const a = burstAngle(ctx);
      const r = w.range * world.random.range(BURST_NEAR, BURST_FAR);
      world.addShot({
        kind: 'mortar',
        x: P.x,
        y: P.y,
        sx: P.x,
        sy: P.y,
        tx: clamp(P.x + Math.cos(a) * r, 0, world.width),
        ty: clamp(P.y + Math.sin(a) * r, 0, world.height),
        t: 0,
        flight: w.flight,
        splash: w.splash,
        splashDmg: w.splashDmg,
        team: P.team,
        ...aceHit(w),
      });
    }
  },
};
