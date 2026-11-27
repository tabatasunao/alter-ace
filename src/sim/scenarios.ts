import { chunks, clamp } from '../core/math';
import type { Random } from '../core/random';
import type { Catalog } from '../data/catalog';
import type { FrameBuild, ZoomFit } from '../data/types';
import { ALLY, ENEMY } from './entities';
import { armyList, spawnGroup } from './spawning';
import { World } from './World';

export interface Viewport {
  width: number;
  height: number;
}

/** What the player chose in the hangar (the game layer's Loadout satisfies this). */
export interface BattleSetup {
  /** The player's name for their ALTER. */
  name: string;
  build: FrameBuild;
  slots: readonly string[];
  aim: string;
  enemies: number;
}

function fitZoom(fit: ZoomFit, viewport: Viewport): number {
  const basis = fit.aspect ? Math.min(viewport.width, viewport.height * fit.aspect) : viewport.width;
  return clamp(basis / fit.reference, fit.min, fit.max);
}

/** Row offset of group `i` of `groups`, centered on 0. */
const groupOffset = (i: number, groups: number, spacing: number) => (i - (groups - 1) / 2) * spacing;

/** The AI-vs-AI skirmish shown behind the hangar. */
export function createDemoWorld(catalog: Catalog, random: Random, viewport: Viewport): World {
  const world = new World(catalog, random, 'demo');
  const { demo, allyMix, enemyMix } = catalog.armies;
  const midY = world.height / 2;

  const allies = armyList(demo.allies, allyMix, catalog.armies, random);
  const enemies = armyList(demo.enemies, enemyMix, catalog.armies, random);
  chunks(allies, demo.groups).forEach((g, i) => spawnGroup(world, g, ALLY, demo.allyX, midY + groupOffset(i, demo.groups, demo.groupSpacing), 1));
  chunks(enemies, demo.groups).forEach((g, i) => spawnGroup(world, g, ENEMY, demo.enemyX, midY + groupOffset(i, demo.groups, demo.groupSpacing), -1));

  world.stats.allyAlive = world.stats.allyTotal = demo.allies;
  world.stats.enemyField = world.stats.enemyTotal = demo.enemies;
  world.camera.x = demo.cameraX;
  world.camera.y = midY;
  world.camera.zoom = world.camera.zoomTarget = fitZoom(catalog.battle.camera.demoZoom, viewport);
  return world;
}

/** A sortie: the ace, 100 allies, and an enemy army that deploys in part and reinforces the rest. */
export function createBattleWorld(catalog: Catalog, random: Random, loadout: BattleSetup, viewport: Viewport): World {
  const world = new World(catalog, random, 'battle');
  const { battle, allyMix, enemyMix, reinforcements } = catalog.armies;
  const midY = world.height / 2;

  world.aim.index = catalog.aimModeIndex(loadout.aim);
  world.camera.zoom = world.camera.zoomTarget = fitZoom(catalog.battle.camera.battleZoom, viewport);
  world.stats.reserveTimer = reinforcements.interval;

  const allies = armyList(battle.allies.count, allyMix, catalog.armies, random);
  world.stats.allyTotal = world.stats.allyAlive = battle.allies.count;
  chunks(allies, battle.allies.groups).forEach((g, i) =>
    spawnGroup(world, g, ALLY, battle.allies.x, midY + groupOffset(i, battle.allies.groups, battle.allies.groupSpacing), 1),
  );

  const total = loadout.enemies;
  const enemies = armyList(total, enemyMix, catalog.armies, random);
  const initial = Math.min(total, battle.enemies.initial);
  world.stats.enemyTotal = total;
  chunks(enemies.slice(0, initial), battle.enemies.groups).forEach((g, i) => {
    const x = battle.enemies.x + random.range(-battle.enemies.xJitter, battle.enemies.xJitter);
    spawnGroup(world, g, ENEMY, x, midY + groupOffset(i, battle.enemies.groups, battle.enemies.groupSpacing), -1);
  });
  world.stats.enemyField = initial;
  world.stats.enemyQueue = enemies.slice(initial);

  const player = world.factory.player(
    catalog.frameFor(loadout.build, loadout.name),
    loadout.slots.map((id) => catalog.weapon(id)),
    battle.playerStartX,
    midY,
  );
  world.units.push(player);
  world.player = player;
  world.camera.x = player.x;
  world.camera.y = player.y;
  return world;
}
