import type { ImpactDef } from '../data/types';
import type { World } from './World';

/**
 * Hit-stop, slow motion, screen shake and screen flash: how big moments land. The simulation holds
 * while `freeze` runs (Simulation.step); the renderer reads `shake` and `flash`. ImpactSystem
 * settles them each step.
 */
export interface ImpactState {
  /** Hit-stop time left: systems without `duringFreeze` hold. */
  freeze: number;
  /** Time until another hit-stop may start. */
  freezeGap: number;
  /** Slow-motion time left (real seconds) and its speed. */
  slow: number;
  slowScale: number;
  /** Screen shake strength in CSS pixels, settling to 0. */
  shake: number;
  /** Screen flash strength (0–1), fading to 0 from `flashPeak`. */
  flash: number;
  flashPeak: number;
  flashDanger: boolean;
  /** Red screen-edge strength (0–1) after the ace is hurt, fading to 0. */
  hurt: number;
  /** Seconds since the world started, held or not (drives the shake's wobble). */
  clock: number;
}

export function newImpactState(): ImpactState {
  return { freeze: 0, freezeGap: 0, slow: 0, slowScale: 1, shake: 0, flash: 0, flashPeak: 0, flashDanger: false, hurt: 0, clock: 0 };
}

/**
 * Applies one impact at `scale` (0–1). Stronger shakes and flashes replace weaker ones. A hit-stop
 * starts only once the gap after the last one has passed, unless `force` (the ace's death).
 */
export function kick(world: World, def: ImpactDef, scale = 1, force = false): void {
  const s = world.impact;
  if (def.freeze > 0 && (force || s.freezeGap <= 0)) {
    s.freeze = Math.max(s.freeze, def.freeze);
    s.freezeGap = def.freeze + world.catalog.battle.impact.freezeGap;
  }
  s.shake = Math.max(s.shake, def.shake * scale);
  s.hurt = Math.max(s.hurt, (def.hurt ?? 0) * scale);
  const flash = def.flash * scale;
  if (flash > s.flash) {
    s.flash = s.flashPeak = flash;
    s.flashDanger = def.danger === true;
  }
}

/** Runs the battle at `scale` speed for `seconds` of real time (after any hit-stop). */
export function slowMotion(world: World, seconds: number, scale: number): void {
  world.impact.slow = Math.max(world.impact.slow, seconds);
  world.impact.slowScale = scale;
}
