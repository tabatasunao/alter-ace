import { chunks, clamp } from '../core/math';
import type { Random } from '../core/random';
import type { Catalog } from '../data/catalog';
import type { FrameBuild, ZoomFit } from '../data/types';
import { ALLY, ENEMY, type Player } from './entities';
import { kick } from './impact';
import { recenterOffset } from './recenter';
import { armyList, groupOffset, spawnGroup } from './spawning';
import { newTutorialState } from './tutorial';
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

/**
 * The tutorial mission: the ace with its loadout and no allies. The stages deploy the enemies
 * (src/sim/systems/TutorialSystem.ts); until then they wait in the reserve, so the HUD counts them.
 */
export function createTutorialWorld(catalog: Catalog, random: Random, loadout: BattleSetup, viewport: Viewport): World {
  const world = new World(catalog, random, 'tutorial');
  const cfg = catalog.armies.tutorial;
  world.aim.index = catalog.aimModeIndex(loadout.aim);
  world.camera.zoom = world.camera.zoomTarget = fitZoom(catalog.battle.camera.battleZoom, viewport);
  world.tutorial = newTutorialState(cfg.stages);
  world.tutorial.viewWidth = viewport.width;
  world.stats.enemyQueue = cfg.stages.flatMap((s) =>
    Array.from({ length: (s.waves ?? 1) * (s.groups ?? 1) }, () => s.spawn.flatMap((g) => Array.from({ length: g.count }, () => g.class))).flat(),
  );
  world.stats.enemyTotal = world.stats.enemyQueue.length;

  const player = world.factory.player(
    catalog.frameFor(loadout.build, loadout.name),
    loadout.slots.map((id) => catalog.weapon(id)),
    cfg.playerStart.x,
    cfg.playerStart.y,
  );
  world.units.push(player);
  world.player = player;
  world.camera.x = player.x;
  world.camera.y = player.y;
  return world;
}

/**
 * The battle right after the tutorial, picking up where it ended: the camera keeps its zoom and the
 * allies deploy just off the west edge of the view and the enemies (all at once, no reserve) just
 * off the east edge, and close in. With `carry`, the tutorial's ace goes on as it was (HP, gauge,
 * ammo, active weapon, aim mode, motion, Full Arms); without (a restart), a fresh ace starts where
 * the last one was. It opens with the launch shake and flash in place of the launch sequence.
 */
export function createFollowUpWorld(catalog: Catalog, random: Random, loadout: BattleSetup, viewport: Viewport, prev: World, carry: boolean): World {
  const world = new World(catalog, random, 'battle');
  const { battle, allyMix, enemyMix, reinforcements, formation, tutorial } = catalog.armies;
  const f = tutorial.followUp;
  const old = prev.player!;
  // Shift so the ace starts near the middle of the battlefield; the camera moves with it, so nothing jumps.
  const { dx, dy } = recenterOffset(world, old.x, old.y, tutorial.recenterStep);
  const from = { x: old.x + dx, y: old.y + dy };
  const zoom = prev.camera.zoom;
  world.aim.index = carry ? prev.aim.index : catalog.aimModeIndex(loadout.aim);
  // The camera goes on as it was: where it looks, its zoom, and the zoom it is easing toward.
  Object.assign(world.camera, prev.camera);
  world.camera.x += dx;
  world.camera.y += dy;
  world.stats.reserveTimer = reinforcements.interval;

  const halfWidth = viewport.width / 2 / zoom;
  const x = (dx: number) => clamp(from.x + dx, formation.edgeMargin, world.width - formation.edgeMargin);
  const deploy = (ids: string[], groups: number, team: typeof ALLY, gx: number, facing: 1 | -1) =>
    chunks(ids, groups).forEach((g, i) => spawnGroup(world, g, team, gx, from.y + groupOffset(i, groups, f.groupSpacing), facing));

  deploy(armyList(f.allies, allyMix, catalog.armies, random), battle.allies.groups, ALLY, x(-halfWidth - f.offscreen), 1);
  world.stats.allyTotal = world.stats.allyAlive = f.allies;
  deploy(armyList(f.enemies, enemyMix, catalog.armies, random, f.exact), battle.enemies.groups, ENEMY, x(halfWidth + f.offscreen), -1);
  world.stats.enemyTotal = world.stats.enemyField = f.enemies;

  const player = carry
    ? Object.assign(carryAce(world, prev, old), from)
    : world.factory.player(catalog.frameFor(loadout.build, loadout.name), loadout.slots.map((id) => catalog.weapon(id)), from.x, from.y);
  world.units.push(player);
  world.player = player;
  kick(world, catalog.battle.impact.launch);
  return world;
}

/**
 * A copy of `old` (from the `prev` world) for `world`: a new id, and everything else as it was.
 * Times and counts tied to the old battle (last hit, Full Arms kill count) move to the new clock;
 * links to old units (reticle, a saber lunge) are dropped.
 */
function carryAce(world: World, prev: World, old: Player): Player {
  const P = world.factory.player(old.frame, old.slots.map((s) => s.def), old.x, old.y);
  return Object.assign(P, {
    vx: old.vx,
    vy: old.vy,
    hp: old.hp,
    flash: old.flash,
    stunT: old.stunT,
    slots: old.slots.map((s) => ({ ...s })),
    active: old.active,
    facing: old.facing,
    iframes: old.iframes,
    dashCd: old.dashCd,
    dodgeArmed: old.dodgeArmed,
    hurtT: old.hurtT,
    hurtK: old.hurtK,
    releaseCharge: old.releaseCharge,
    release: old.release && { ...old.release, killsAtStart: old.release.killsAtStart - prev.stats.kills },
    dash: old.dash && { ...old.dash },
    jolt: old.jolt && { ...old.jolt },
    statuses: old.statuses.map((s) => ({ ...s })),
    lastHit: old.lastHit - prev.t,
    input: { ...old.input },
  });
}
