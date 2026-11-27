import { launchShot } from '../attacks';
import type { Knock } from '../../data/types';
import { aceHit, type FlyingShot, type Homing, type Player, type Unit } from '../entities';
import type { World } from '../World';

const SPAWN_OFFSET = 12;
const DEFAULT_RADIUS = 2.5;
/** A shot lives long enough to fly a bit past the weapon's range. */
const RANGE_LIFE_FACTOR = 1.1;

export interface ShotOptions {
  kind?: FlyingShot['kind'];
  /** Launch speed; defaults to the weapon's speed. */
  speed?: number;
  /** Random ± fraction applied to speed. */
  jitter?: number;
  life?: number;
  r?: number;
  pierce?: number;
  splash?: number;
  splashDmg?: number;
  homing?: Homing;
  target?: Unit;
  knock?: Knock;
}

interface ShotWeapon {
  id: string;
  damageType: string;
  dmg: number;
  range: number;
  speed: number;
}

/** Launches one of the ace's projectiles from just in front of the ace. */
export function firePlayerShot(world: World, P: Player, w: ShotWeapon, angle: number, o: ShotOptions = {}): void {
  const speed = (o.speed || w.speed) * (o.jitter ? world.random.range(1 - o.jitter, 1 + o.jitter) : 1);
  launchShot(world, P.team, P.x + Math.cos(angle) * SPAWN_OFFSET, P.y + Math.sin(angle) * SPAWN_OFFSET, angle, aceHit(w), {
    kind: o.kind ?? 'bullet',
    speed,
    maxSpeed: w.speed,
    dmg: w.dmg,
    life: o.life || (w.range * RANGE_LIFE_FACTOR) / speed,
    r: o.r || DEFAULT_RADIUS,
    pierce: o.pierce || 0,
    splash: o.splash || 0,
    splashDmg: o.splashDmg || 0,
    homing: o.homing ?? null,
    target: o.target ?? null,
    knock: o.knock ?? null,
  });
}

/** Random angle offset in ±spread. */
export function spreadAngle(world: World, angle: number, spread: number): number {
  return angle + (world.random.next() - 0.5) * 2 * spread;
}
