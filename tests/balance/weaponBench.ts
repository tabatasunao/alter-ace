import type { Point } from '../../src/core/math';
import { SeededRandom } from '../../src/core/random';
import type { Catalog } from '../../src/data/catalog';
import { buildCatalog } from '../../src/data/load';
import type { GameData } from '../../src/data/types';
import { ENEMY, type Player, type Soldier } from '../../src/sim/entities';
import type { MoveInput } from '../../src/sim/input';
import { battlePipeline } from '../../src/sim/pipelines';
import { createBattleWorld } from '../../src/sim/scenarios';
import { armyList, spawnGroup } from '../../src/sim/spawning';
import type { World } from '../../src/sim/World';
import { readRawData, VIEWPORT } from '../helpers';

/**
 * Weapon benchmark: the ace, flown by a simple bot pilot, fights an enemy formation alone
 * with one weapon. The enemies move and shoot as in a real battle. The ace takes only a
 * vanishing fraction of damage, so it never dies but we can still measure how much fire
 * it drew (`incomingPerMin`: the damage it would have taken).
 */

const DT = 1 / 60;
/** Ace damage scale in the bench; incoming damage is divided back up by this. */
const GHOST = 1e-6;
const ACE_START = { x: 2200, y: 1700 };
const ENEMY_DISTANCE = 750;
/** Share of the formation's total HP that ends the measurement window. */
const MEASURE_SHARE = 0.9;

export interface BenchOptions {
  weapon: string;
  /** Enemy class ids to deploy, or a count to draw from the enemy army mix. */
  enemies: readonly string[] | number;
  seed?: number;
  frame?: string;
  maxTime?: number;
}

export interface BenchResult {
  weapon: string;
  /** Seconds to destroy every enemy, or null if time ran out. */
  clearTime: number | null;
  /** Enemy hit points destroyed per second, net of healing (overkill not counted), until 90% are gone. */
  hpPerSecond: number;
  kills: number;
  /** Raw damage the ace would have taken per minute over the same window: how exposed the weapon keeps you. */
  incomingPerMin: number;
}

/** A copy of the catalog in which the ace takes (almost) no damage. */
export function benchCatalog(raw: Record<string, unknown> = readRawData()): Catalog {
  const data = structuredClone(raw) as unknown as GameData;
  data.battle.balance.aceDamageTaken = GHOST;
  return buildCatalog(data as never);
}

export function runBench(catalog: Catalog, o: BenchOptions): BenchResult {
  const seed = o.seed ?? 1;
  const maxTime = o.maxTime ?? 120;
  const d = catalog.loadout.defaultLoadout;
  const world = createBattleWorld(
    catalog,
    new SeededRandom(seed),
    { frame: o.frame ?? d.frame, slots: [o.weapon], aim: d.aim, enemies: 0 },
    VIEWPORT,
  );
  const P = world.player!;
  P.x = ACE_START.x;
  P.y = ACE_START.y;
  world.units = [P];
  world.stats.enemyQueue = [];

  const ids = typeof o.enemies === 'number' ? armyList(o.enemies, catalog.armies.enemyMix, catalog.armies, world.random) : [...o.enemies];
  spawnGroup(world, ids, ENEMY, ACE_START.x + ENEMY_DISTANCE, ACE_START.y, -1);
  const enemies = world.units.filter((u): u is Soldier => u.kind === 'soldier');
  world.stats.enemyField = world.stats.enemyTotal = enemies.length;
  world.grid.rebuild(world.units);
  const totalHp = enemies.reduce((sum, u) => sum + u.maxHp, 0);

  const weapon = catalog.armament(o.weapon);
  const range = 'range' in weapon ? weapon.range : 300;
  const sim = battlePipeline(botPilot(world, P, weapon.id === 'saber' || range < 200 ? 0 : range * 0.8));

  const destroyed = () => totalHp - enemies.reduce((sum, u) => sum + (u.alive ? Math.max(0, u.hp) : 0), 0);
  // Rates are measured until MEASURE_SHARE of the formation's HP is gone, so a last straggler the
  // bot pilot fails to chase down does not skew a weapon's damage output.
  let window: { t: number; destroyed: number; taken: number } | null = null;
  let t = 0;
  while (!world.status.over && t < maxTime) {
    sim.step(world, DT);
    t += DT;
    if (!window) {
      const gone = destroyed();
      if (gone >= totalHp * MEASURE_SHARE) window = { t, destroyed: gone, taken: world.stats.dmgTaken };
    }
  }
  const w = window ?? { t, destroyed: destroyed(), taken: world.stats.dmgTaken };
  return {
    weapon: o.weapon,
    clearTime: world.status.over ? t : null,
    hpPerSecond: w.destroyed / w.t,
    kills: world.stats.kills,
    incomingPerMin: (w.taken / GHOST / w.t) * 60,
  };
}

/** A melee pilot: flies straight at the nearest enemy, as a saber player charges in. */
function chasePilot(world: World, P: Player): MoveInput {
  return {
    read(): Point {
      let best: Soldier | null = null;
      let bestD = Infinity;
      for (const u of world.units) {
        if (u.kind !== 'soldier' || u.team !== ENEMY || !u.alive) continue;
        const d = Math.hypot(u.x - P.x, u.y - P.y);
        if (d < bestD) {
          bestD = d;
          best = u;
        }
      }
      return best ? { x: (best.x - P.x) / bestD, y: (best.y - P.y) / bestD } : { x: 0, y: 0 };
    },
  };
}

/**
 * Keeps the nearest enemy at `distance` while circling, like a player kiting a formation. Out of
 * position it heads straight in or out (so it can catch units that retreat). When too close it backs away from the nearby enemy mass (not just the nearest unit), so it
 * doesn't reverse into another group. Steers by velocity error, so it copes with thruster inertia.
 */
function botPilot(world: World, P: Player, distance: number): MoveInput {
  if (distance === 0) return chasePilot(world, P);
  let orbit = 1;
  const crowd = distance + 400;
  return {
    read(): Point {
      let best: Soldier | null = null;
      let bestD = Infinity;
      let awayX = 0;
      let awayY = 0;
      for (const u of world.units) {
        if (u.kind !== 'soldier' || u.team !== ENEMY || !u.alive) continue;
        const dd = Math.hypot(u.x - P.x, u.y - P.y) || 1;
        if (dd < bestD) {
          bestD = dd;
          best = u;
        }
        if (dd < crowd) {
          const w = 1 / (dd * dd);
          awayX += ((P.x - u.x) / dd) * w;
          awayY += ((P.y - u.y) / dd) * w;
        }
      }
      if (!best) return { x: 0, y: 0 };
      const ux = (best.x - P.x) / bestD;
      const uy = (best.y - P.y) / bestD;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      // Flip the orbit near the top or bottom edge.
      if (P.y < 400) orbit = uy > 0 ? 1 : -1;
      if (P.y > world.height - 400) orbit = uy > 0 ? -1 : 1;
      const radial = Math.max(-1, Math.min(1, (bestD - distance) / 120));
      // Closing in: head for the nearest enemy. Backing off: away from the crowd.
      const rx = radial > 0 ? ux * radial : (awayX / awayLen) * -radial;
      const ry = radial > 0 ? uy * radial : (awayY / awayLen) * -radial;
      const speed = P.frame.speed * 0.7;
      // Circle only near the wanted distance; out of position, go straight for it (so it catches kiting units).
      const circle = 0.6 * (1 - Math.abs(radial));
      const wantVx = (rx + -uy * orbit * circle) * speed;
      const wantVy = (ry + ux * orbit * circle) * speed;
      return { x: (wantVx - P.vx) / 60, y: (wantVy - P.vy) / 60 };
    },
  };
}
