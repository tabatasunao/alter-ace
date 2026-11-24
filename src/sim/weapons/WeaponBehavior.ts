import type { WeaponDef } from '../../data/types';
import type { Player, Soldier } from '../entities';
import type { World } from '../World';

export interface FireContext<W extends WeaponDef = WeaponDef> {
  readonly world: World;
  readonly player: Player;
  readonly weapon: W;
  /** Targets ranked by the aim mode, best first. Never empty. */
  readonly targets: readonly Soldier[];
  /** Angle from the ace to targets[0]. */
  readonly angle: number;
  /** Rounds left in the magazine (Infinity when unlimited). */
  readonly ammo: number;
}

/** Super release's opening burst for one weapon: `count` rounds sprayed at random within an arc. */
export interface BurstContext<W extends WeaponDef = WeaponDef> {
  readonly world: World;
  readonly player: Player;
  readonly weapon: W;
  /** How many rounds (pellets, missiles…) to launch. */
  readonly count: number;
  /** Center of the spray: the ace's facing. */
  readonly facing: number;
  /** Width of the spray in radians: 2π all around, or the weapon's `burstArc` (front only). */
  readonly arc: number;
}

/** A random direction within the burst's arc: the spray of a pilot firing wildly. */
export function burstAngle(ctx: BurstContext): number {
  return ctx.facing + (ctx.world.random.next() - 0.5) * ctx.arc;
}

/**
 * How one kind of weapon fires. Ammo, cooldown and reload are handled by the caller
 * (PlayerWeaponSystem), so a behavior only creates shots, damage and effects, or starts a lunge
 * on the ace (the Beam Saber; PlayerMovementSystem carries it and the slash runs on arrival).
 *
 * To add a weapon behavior: add its def type to WeaponDef (src/data/types.ts),
 * implement this interface in behaviors/, and register it in registry.ts.
 */
export interface WeaponBehavior<W extends WeaponDef = WeaponDef> {
  /** Fires once and returns how many rounds that used. */
  fire(ctx: FireContext<W>): number;
  /** How many ranked targets `fire` wants in `ctx.targets` (default 1). */
  targetsWanted?(weapon: W): number;
  /** Rounds one shot launches (pellets, salvo), for sizing the burst (default 1). */
  roundsPerShot?(weapon: W): number;
  /** Super release's burst: spray `count` rounds (burstAngle), with or without targets, using no ammo. */
  burst?(ctx: BurstContext<W>): void;
}
