import type { UnitWeaponDef } from '../../../data/types';
import { launchShot, type ShotSpec } from '../../attacks';
import { armyHit, type Soldier } from '../../entities';
import type { World } from '../../World';

/** Launches one AI projectile from the edge of the unit's body along `angle`, with the weapon's damage. */
export function launchUnitShot(world: World, u: Soldier, w: UnitWeaponDef, angle: number, o: Omit<ShotSpec, 'dmg'>): void {
  const x = u.x + Math.cos(angle) * u.size * 0.6;
  const y = u.y + Math.sin(angle) * u.size * 0.6;
  launchShot(world, u.team, x, y, angle, armyHit(u, w), { ...o, dmg: w.dmg });
}
