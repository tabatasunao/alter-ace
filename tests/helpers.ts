import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SeededRandom } from '../src/core/random';
import type { Catalog } from '../src/data/catalog';
import { buildCatalog, DATA_FILES, type DataFileName } from '../src/data/load';
import { isWeapon, type UnitWeaponDef } from '../src/data/types';
import { ENEMY, type Hit, type Soldier, type Team } from '../src/sim/entities';
import { createBattleWorld, type BattleSetup } from '../src/sim/scenarios';
import type { Simulation } from '../src/sim/System';
import type { World } from '../src/sim/World';

export const VIEWPORT = { width: 1280, height: 720 };

/** The real public/data files, read from disk. */
export function readRawData(): Record<DataFileName, unknown> {
  return Object.fromEntries(
    DATA_FILES.map((name) => {
      const path = fileURLToPath(new URL(`../public/data/${name}.json`, import.meta.url));
      return [name, JSON.parse(readFileSync(path, 'utf8'))];
    }),
  ) as Record<DataFileName, unknown>;
}

export function loadTestCatalog(): Catalog {
  return buildCatalog(readRawData());
}

export function setup(catalog: Catalog, overrides: Partial<BattleSetup> = {}): BattleSetup {
  const d = catalog.loadout.defaultLoadout;
  return { frame: d.frame, slots: [...d.slots], aim: d.aim, enemies: d.enemies, ...overrides };
}

/** A full sortie as the game deploys it. */
export function battle(catalog: Catalog, seed = 1, overrides: Partial<BattleSetup> = {}): World {
  return createBattleWorld(catalog, new SeededRandom(seed), setup(catalog, overrides), VIEWPORT);
}

/** A sortie with every AI unit removed: just the ace, for focused tests. Add units with `addSoldier`. */
export function arena(catalog: Catalog, overrides: Partial<BattleSetup> = {}): World {
  const world = battle(catalog, 1, overrides);
  world.units = [world.player!];
  world.stats.enemyField = 0;
  world.stats.enemyQueue = [];
  world.stats.allyAlive = world.stats.allyTotal;
  world.grid.rebuild(world.units);
  return world;
}

/** An untyped hit from the AI armies. */
export const ARMY_HIT: Hit = { src: 'army', wid: null, dtype: null };

/** A hit from one of the ace's weapons, with that weapon's damage type. */
export function aceHit(catalog: Catalog, weaponId: string): Hit {
  const w = catalog.armament(weaponId);
  if (!isWeapon(w)) throw new Error(`"${weaponId}" is not a weapon`);
  return { src: 'player', wid: w.id, dtype: w.damageType };
}

/** Adds an AI unit and re-buckets the grid. Pass `weaponId` to arm it with that unit weapon instead of its class weapon. */
export function addSoldier(world: World, classId: string, team: Team, x: number, y: number, weaponId?: string): Soldier {
  const u = world.factory.soldier(world.catalog.unitClass(classId), team, x, y);
  if (weaponId) (u as { weapon: UnitWeaponDef }).weapon = world.catalog.unitWeapon(weaponId);
  world.units.push(u);
  if (team === ENEMY) world.stats.enemyField++;
  world.grid.rebuild(world.units);
  return u;
}

/** Runs the simulation for `seconds` at a fixed dt. */
export function run(world: World, sim: Simulation, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(world, dt);
}
