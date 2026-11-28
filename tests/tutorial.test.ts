import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/random';
import { buildCatalog } from '../src/data/load';
import type { GameData } from '../src/data/types';
import { ALLY, ENEMY, type Soldier } from '../src/sim/entities';
import type { MoveInput } from '../src/sim/input';
import { tutorialPipeline } from '../src/sim/pipelines';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { createFollowUpWorld, createTutorialWorld } from '../src/sim/scenarios';
import { launchShot } from '../src/sim/attacks';
import { recenterOffset, shiftWorld } from '../src/sim/recenter';
import { currentStage, stageCount } from '../src/sim/tutorial';
import type { World } from '../src/sim/World';
import { addSoldier, loadTestCatalog, readRawData, setup, VIEWPORT } from './helpers';

const DT = 1 / 60;

function tutorial(seed = 1) {
  const catalog = loadTestCatalog();
  return createTutorialWorld(catalog, new SeededRandom(seed), setup(catalog), VIEWPORT);
}

/** A pilot that flies to the marker, then toward the nearest enemy, and stops just inside weapon range. */
function pilot(world: World): MoveInput {
  return {
    read() {
      const P = world.player!;
      const t = world.tutorial!;
      let goal = t.marker;
      if (!goal) {
        let best = Infinity;
        for (const u of world.units) {
          if (u.team !== ENEMY || !u.alive) continue;
          const d = Math.hypot(u.x - P.x, u.y - P.y);
          if (d < best && d > 250) {
            best = d;
            goal = { x: u.x, y: u.y, r: 0 };
          }
        }
      }
      return goal ? { x: goal.x - P.x, y: goal.y - P.y } : { x: 0, y: 0 };
    },
  };
}

/** Credits the ace with a kill by weapon `wid`, as scoreDeath does. */
function credit(world: World, wid: string): void {
  world.stats.kills++;
  world.stats.killsBy[wid] = (world.stats.killsBy[wid] ?? 0) + 1;
}

/** Steps the battle `seconds`; a hit-stop (a full-strength Railgun hit, Full Arms) holds it for a few frames. */
function run(sim: { step(world: World, dt: number): void }, world: World, seconds: number): void {
  for (let i = 0; i < seconds / DT; i++) sim.step(world, DT);
}

/** Destroys the stage's remaining waves (the goals already met), waiting out each gap. */
function clearWaves(sim: { step(world: World, dt: number): void }, world: World): void {
  const t = world.tutorial!;
  const steps = (world.catalog.armies.tutorial.respawnGap + 0.5) / DT;
  for (let i = 0; i < 10; i++) {
    killGroup(world);
    // Until the stage clears (stop before the next one begins) or the next wave is out.
    for (let j = 0; j < steps; j++) {
      sim.step(world, DT);
      if (t.clearedAt >= 0) return;
      if (t.group.some((u) => u.alive)) break;
    }
  }
}

/** Removes the current stage's enemies without crediting anyone. */
function killGroup(world: World): void {
  for (const u of world.tutorial!.group) u.alive = false;
  world.stats.enemyField = 0;
}

describe('tutorial mission', () => {
  it('starts with the ace alone and every enemy in reserve', () => {
    const world = tutorial();
    const cfg = world.catalog.armies.tutorial;
    const total = cfg.stages.reduce((n, s) => n + (s.waves ?? 1) * (s.groups ?? 1) * s.spawn.reduce((m, g) => m + g.count, 0), 0);
    expect(world.mode).toBe('tutorial');
    expect(world.units).toEqual([world.player]);
    expect(world.stats).toMatchObject({ allyTotal: 0, enemyField: 0, enemyTotal: total });
    expect(world.stats.enemyQueue).toHaveLength(total);
    expect(world.player).toMatchObject({ x: cfg.playerStart.x, y: cfg.playerStart.y });
  });

  it('can be played through stage by stage, and the ace survives', () => {
    const world = tutorial();
    const sim = tutorialPipeline(pilot(world));
    const commands = new PlayerCommands(world);
    const t = world.tutorial!;
    const stagesSeen: string[] = [];
    const cleared: number[] = [];
    world.events.on('tutorialStage', ({ index }) => stagesSeen.push(t.stages[index]!.id));
    world.events.on('tutorialCleared', ({ index }) => cleared.push(index));
    let minHp = Infinity;
    for (let i = 0; i < 60 * 240 && !world.status.over; i++) {
      // Do what the stage asks, a moment after it begins.
      const stage = currentStage(t);
      if (t.begun && t.clearedAt < 0 && world.t > 1) {
        const P = world.player!;
        const beam = P.slots.findIndex((slot) => slot.def.damageType === 'beam');
        if (stage.use === 'weapons') commands.selectSlot(t.used ? beam : (P.active + 1) % P.slots.length);
        if (stage.use === 'aim' && !t.used) commands.cycleAim(1);
        if (stage.use === 'dash' && !t.used) commands.dash();
        // Full Arms once in among the crowd, as the stage says.
        const near = world.units.some((u) => u.team === ENEMY && u.alive && Math.hypot(u.x - P.x, u.y - P.y) < 300);
        if (stage.use === 'fullArms' && !t.used && near) commands.superRelease();
      }
      sim.step(world, DT);
      minHp = Math.min(minHp, world.player!.hp);
    }
    expect(stagesSeen).toEqual(t.stages.map((s) => s.id));
    expect(cleared).toEqual(t.stages.map((_, i) => i));
    expect(world.status).toMatchObject({ over: true, win: true });
    expect(world.player!.alive).toBe(true);
    expect(minHp).toBeGreaterThanOrEqual(world.player!.maxHp * world.catalog.armies.tutorial.hpFloor - 1e-9);
    expect(world.enemiesLeft).toBe(0);
    expect(world.t).toBeLessThan(150); // a perfect pilot; a new player should still finish in a few minutes
  });

  it('keeps the ace above its HP floor, however hard it is hit', () => {
    const world = tutorial();
    const P = world.player!;
    world.combat.damage(P, P.maxHp * 10, { src: 'army', dtype: 'kinetic' } as never);
    expect(P.alive).toBe(true);
    expect(P.hp).toBeCloseTo(P.maxHp * world.catalog.armies.tutorial.hpFloor);
  });

  it('takes the rings of a stage one at a time, in order', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const P = world.player!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    const stage = t.stages.find((s) => s.markers?.length)!;
    t.index = t.stages.indexOf(stage);
    sim.step(world, DT);
    const origin = { ...t.origin };
    stage.markers!.forEach((m, i) => {
      expect(t.marker).toMatchObject({ x: origin.x + m.dx, y: origin.y + m.dy, r: m.radius });
      expect(t.clearedAt).toBe(-1);
      P.x = t.marker!.x;
      P.y = t.marker!.y;
      sim.step(world, DT);
      expect(t.reached).toBe(i + 1);
    });
    expect(t.marker).toBeNull();
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
  });

  it('ends the weapons stage on its beam kill goal after a switch, and the rest withdraw', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    t.index = t.stages.findIndex((s) => s.use === 'weapons');
    run(sim, world, 0.25);
    credit(world, 'sniper'); // before switching: does not count
    run(sim, world, 0.25);
    new PlayerCommands(world).selectSlot((world.player!.active + 1) % world.player!.slots.length);
    credit(world, 'bazooka'); // a blast weapon: does not count
    run(sim, world, 0.25);
    expect(t.kills).toBe(0);
    credit(world, 'sniper');
    run(sim, world, 0.25);
    expect(t.kills).toBe(1);
    const goal = currentStage(t).kill!.count;
    for (let i = 2; i < goal; i++) credit(world, 'sniper');
    run(sim, world, 0.25);
    expect(t.kills).toBe(goal - 1);
    expect(t.clearedAt).toBe(-1);
    // The last kill ends the step at once, with Bulwarks still standing: they withdraw, no credit.
    const field = world.stats.enemyField;
    const standing = t.group.filter((u) => u.alive).length;
    const kills = world.stats.kills;
    expect(standing).toBeGreaterThan(0);
    credit(world, 'sniper');
    sim.step(world, DT);
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
    expect(t.group.every((u) => !u.alive)).toBe(true);
    expect(world.stats.enemyField).toBe(field - standing);
    expect(world.stats.kills).toBe(kills + 1);
  });

  it('counts any kill toward a damage-type goal when no hardpoint carries that type', () => {
    const catalog = loadTestCatalog();
    const world = createTutorialWorld(catalog, new SeededRandom(1), setup(catalog, { slots: ['bazooka', 'rail', 'shotgun', 'missile'] }), VIEWPORT);
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    t.index = t.stages.findIndex((s) => s.use === 'weapons');
    run(sim, world, 0.25);
    new PlayerCommands(world).selectSlot(1);
    credit(world, 'rail');
    run(sim, world, 0.25);
    expect(t.kills).toBe(1);
  });

  it('clears the aim stage only after a kill in a new aim mode', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    const commands = new PlayerCommands(world);
    t.index = t.stages.findIndex((s) => s.use === 'aim');
    run(sim, world, 0.25);
    commands.cycleAim(1);
    run(sim, world, 0.25);
    commands.cycleAim(-1); // back to the mode the stage began in
    run(sim, world, 0.25);
    credit(world, 'bazooka');
    killGroup(world);
    run(sim, world, 0.25);
    expect(t.used).toBe(true);
    expect(t.kills).toBe(0);
    expect(t.clearedAt).toBe(-1);
    for (let i = 0; i < (world.catalog.armies.tutorial.respawnGap / DT) * 1.1; i++) sim.step(world, DT);
    expect(t.group.every((u) => u.alive)).toBe(true); // redeployed
    commands.cycleAim(1);
    credit(world, 'bazooka');
    run(sim, world, 0.25);
    expect(t.kills).toBe(1);
    clearWaves(sim, world);
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
  });

  it('asks the Full Arms stage to destroy every enemy left after Full Arms', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    t.index = t.stages.findIndex((s) => s.use === 'fullArms');
    run(sim, world, 0.25);
    new PlayerCommands(world).superRelease();
    run(sim, world, 0.25);
    expect(t.used).toBe(true);
    expect(currentStage(t).afterText).toBeTruthy();
    for (let i = 0; i < 60; i++) sim.step(world, DT);
    expect(t.clearedAt).toBe(-1); // enemies are left
    killGroup(world);
    run(sim, world, 0.25);
    expect(world.status).toMatchObject({ over: true, win: true });
  });

  it('sends its waves from the reserve, then the same group again while a goal is open', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    const stage = t.stages.find((s) => s.use === 'aim' && (s.waves ?? 1) > 1)!;
    t.index = t.stages.indexOf(stage);
    sim.step(world, DT);
    const gap = world.catalog.armies.tutorial.respawnGap;
    const total = world.stats.enemyTotal;
    for (let wave = 1; wave <= stage.waves! + 1; wave++) {
      const group = t.group;
      const reserve = world.stats.enemyQueue.length;
      killGroup(world);
      run(sim, world, gap * 0.5);
      expect(t.group).toBe(group); // still waiting out the gap
      run(sim, world, gap * 0.6);
      expect(t.group).not.toBe(group);
      expect(t.group).toHaveLength(group.length);
      expect(t.group.every((u) => u.alive && u.team === ENEMY)).toBe(true);
      expect(t.clearedAt).toBe(-1); // no kill in a new aim mode yet
      if (wave < stage.waves!) {
        expect(world.stats.enemyQueue).toHaveLength(reserve - group.length); // the next wave, from the reserve
        expect(world.stats.enemyTotal).toBe(total);
      } else {
        expect(world.stats.enemyQueue).toHaveLength(reserve); // an extra group, added to the total
        expect(world.stats.enemyTotal).toBeGreaterThan(total);
      }
    }
    expect(t.wavesCleared).toBe(stage.waves! + 1);
    new PlayerCommands(world).cycleAim(1);
    run(sim, world, 0.1);
    credit(world, 'bazooka');
    killGroup(world);
    run(sim, world, 0.25);
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
  });

  it('clears a stage with waves only after the last wave', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    const stage = t.stages.find((s) => !s.use && (s.waves ?? 1) > 1)!;
    t.index = t.stages.indexOf(stage);
    sim.step(world, DT);
    for (let wave = 1; wave < stage.waves!; wave++) {
      killGroup(world);
      run(sim, world, world.catalog.armies.tutorial.respawnGap + 0.1);
      expect(t.clearedAt).toBe(-1);
      expect(t.wavesCleared).toBe(wave);
    }
    killGroup(world);
    run(sim, world, 0.1);
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
  });

  it('follows up with a small battle that closes in from off screen around the ace', () => {
    const prev = tutorial();
    const catalog = prev.catalog;
    const f = catalog.armies.tutorial.followUp;
    Object.assign(prev.player!, { x: 2600, y: 1500 });
    prev.camera.zoom = 0.68;
    const from = { x: 2600, y: 1500, zoom: 0.68 };
    const world = createFollowUpWorld(catalog, new SeededRandom(1), setup(catalog), VIEWPORT, prev, true);
    const soldiers = (team: number) => world.units.filter((u): u is Soldier => u.kind === 'soldier' && u.team === team);
    const halfWidth = VIEWPORT.width / 2 / from.zoom;
    expect(soldiers(ALLY)).toHaveLength(f.allies);
    expect(soldiers(ENEMY)).toHaveLength(f.enemies);
    expect(world.stats).toMatchObject({ allyTotal: f.allies, enemyTotal: f.enemies, enemyField: f.enemies });
    expect(world.stats.enemyQueue).toHaveLength(0);
    expect(world.mode).toBe('battle');
    expect(world.player).toMatchObject({ x: from.x, y: from.y });
    expect(world.camera).toEqual(prev.camera);
    expect(world.camera).not.toBe(prev.camera);
    // Everyone starts outside the view: allies to the west, enemies to the east.
    expect(soldiers(ALLY).every((u) => u.x < from.x - halfWidth)).toBe(true);
    expect(soldiers(ENEMY).every((u) => u.x > from.x + halfWidth)).toBe(true);
    // Exactly the fixed classes: one Commander and one of each semi-ace.
    for (const [id, n] of Object.entries(f.exact)) expect(soldiers(ENEMY).filter((u) => u.def.id === id)).toHaveLength(n);
    expect(soldiers(ENEMY).filter((u) => u.def.semiAce).length).toBe(Object.keys(f.exact).filter((id) => catalog.unitClass(id).semiAce).length);
  });

  it('carries the tutorial ace into the first mission as it was', () => {
    const prev = tutorial();
    const old = prev.player!;
    const sim = tutorialPipeline({ read: () => ({ x: 1, y: 0.5 }) });
    run(sim, prev, 2);
    prev.combat.damage(old, old.maxHp * 0.5, { src: 'army', dtype: 'kinetic' } as never);
    const commands = new PlayerCommands(prev);
    commands.selectSlot(2);
    commands.cycleAim(1);
    old.releaseCharge = 0.75;
    old.slots[2]!.ammo = 1;
    old.dashCd = 0.5;
    const { dx, dy } = recenterOffset(prev, old.x, old.y, prev.catalog.armies.tutorial.recenterStep);
    const world = createFollowUpWorld(prev.catalog, new SeededRandom(1), setup(prev.catalog), VIEWPORT, prev, true);
    const P = world.player!;
    expect(P).not.toBe(old);
    expect(world.units.filter((u) => u.id === P.id)).toEqual([P]); // its id is free in the new battle
    // Shifted toward the middle with the camera, so its place on screen is the same.
    expect(P.x - world.camera.x).toBeCloseTo(old.x - prev.camera.x);
    expect(P.y - world.camera.y).toBeCloseTo(old.y - prev.camera.y);
    expect(P).toMatchObject({ x: old.x + dx, y: old.y + dy, vx: old.vx, vy: old.vy, facing: old.facing, hp: old.hp, active: 2, releaseCharge: 0.75, dashCd: 0.5 });
    expect(P.slots[2]!.ammo).toBe(1);
    expect(P.slots[2]).not.toBe(old.slots[2]);
    expect(world.aim.index).toBe(prev.aim.index);
    expect(P.lastHit).toBeCloseTo(old.lastHit - prev.t);
  });

  it('shifts the battle at the start of each stage so the ace is near the middle, without a jump on screen', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const P = world.player!;
    const sim = tutorialPipeline({ read: () => ({ x: 1, y: 0 }) });
    const step = world.catalog.armies.tutorial.recenterStep;
    t.index = t.stages.findIndex((s) => s.markers?.length);
    run(sim, world, 0.5);
    // Far off to the east, moving, with a shot in flight, as the next stage begins.
    shiftWorld(world, 2000, 0);
    const before = { sx: P.x - world.camera.x, sy: P.y - world.camera.y, vx: P.vx, vy: P.vy, x: P.x };
    t.index++;
    t.begun = false;
    sim.step(world, DT);
    expect(Math.abs(P.x - world.width / 2)).toBeLessThanOrEqual(step / 2 + 50);
    expect(Math.abs(P.y - world.height / 2)).toBeLessThanOrEqual(step / 2 + 50);
    expect(P.x - before.x).toBeLessThan(-step / 2); // it moved back west
    expect(P.x - world.camera.x).toBeCloseTo(before.sx, -1); // within one step of camera follow
    expect(P.y - world.camera.y).toBeCloseTo(before.sy, -1);
    expect(Math.hypot(P.vx - before.vx, P.vy - before.vy)).toBeLessThan(50); // still flying
  });

  it('moves units, shots, effects and the camera together when the battle shifts', () => {
    const world = tutorial();
    const P = world.player!;
    const e = addSoldier(world, 'trooper', ENEMY, P.x + 300, P.y);
    launchShot(world, ENEMY, P.x + 100, P.y + 50, 0, { src: 'army', dtype: 'kinetic' } as never, { kind: 'bullet', speed: 100, dmg: 1, life: 2, r: 2 });
    world.addFx({ type: 'line', x: 10, y: 20, x2: 30, y2: 40, tone: 'enemy', width: 2, t: 0, life: 1 });
    const cam = { ...world.camera };
    const [px, py, ex, ey, shot] = [P.x, P.y, e.x, e.y, { ...world.shots[0]! }];
    shiftWorld(world, -1000, 1000);
    expect([P.x, P.y, e.x, e.y]).toEqual([px - 1000, py + 1000, ex - 1000, ey + 1000]);
    expect(world.shots[0]).toMatchObject({ x: shot.x - 1000, y: shot.y + 1000 });
    expect(world.fx.at(-1)).toMatchObject({ x: -990, y: 1020, x2: -970, y2: 1040 });
    expect(world.camera).toMatchObject({ x: cam.x - 1000, y: cam.y + 1000, zoom: cam.zoom });
  });

  it('counts each step: kills toward a goal of several, or enemies destroyed of all its waves, or rings, or uses', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const sim = tutorialPipeline({ read: () => ({ x: 0, y: 0 }) });
    const at = (id: string) => {
      t.index = t.stages.findIndex((s) => s.id === id);
      t.begun = false;
      sim.step(world, DT);
    };
    at('move');
    expect(stageCount(t)).toEqual({ done: 0, total: 3 });
    at('dash');
    expect(stageCount(t)).toEqual({ done: 0, total: 2 });

    at('fire');
    const fire = currentStage(t);
    const perWave = (fire.groups ?? 1) * fire.spawn.reduce((n, g) => n + g.count, 0);
    const total = perWave * (fire.waves ?? 1);
    expect(stageCount(t)).toEqual({ done: 0, total });
    t.group[0]!.alive = false;
    expect(stageCount(t)).toEqual({ done: 1, total });
    killGroup(world);
    run(sim, world, world.catalog.armies.tutorial.respawnGap + 0.1);
    expect(t.group.every((u) => u.alive)).toBe(true); // the next wave
    expect(stageCount(t)).toEqual({ done: perWave, total });

    // A kill goal of more than one shows its own progress: kills after the switch, with a beam weapon.
    at('weapons');
    const goal = currentStage(t).kill!.count;
    expect(goal).toBeGreaterThan(1);
    expect(stageCount(t)).toEqual({ done: 0, total: goal });
    new PlayerCommands(world).selectSlot((world.player!.active + 1) % world.player!.slots.length);
    run(sim, world, 0.1);
    credit(world, 'sniper');
    credit(world, 'sniper');
    run(sim, world, 0.1);
    expect(stageCount(t)).toEqual({ done: 2, total: goal });

    // A group that has to come again (a goal still open after the last wave) adds to the total.
    at('aim');
    const aim = currentStage(t);
    const aTotal = (aim.groups ?? 1) * aim.spawn.reduce((n, g) => n + g.count, 0) * (aim.waves ?? 1);
    for (let i = 0; i < (aim.waves ?? 1); i++) {
      killGroup(world);
      run(sim, world, world.catalog.armies.tutorial.respawnGap + 0.1);
    }
    expect(stageCount(t)).toEqual({ done: aTotal, total: aTotal + t.group.length });
  });

  it('starts a fresh ace where the last one was when the first mission restarts', () => {
    const prev = tutorial();
    const old = prev.player!;
    old.hp = old.maxHp * 0.3;
    old.releaseCharge = 0.9;
    const { dx, dy } = recenterOffset(prev, old.x, old.y, prev.catalog.armies.tutorial.recenterStep);
    const world = createFollowUpWorld(prev.catalog, new SeededRandom(1), setup(prev.catalog), VIEWPORT, prev, false);
    expect(world.player).toMatchObject({ x: old.x + dx, y: old.y + dy, hp: old.maxHp, releaseCharge: prev.catalog.battle.player.superRelease.charge.start });
  });

  it('asks for separate uses of a control when the stage has a use count', () => {
    const world = tutorial();
    const t = world.tutorial!;
    const P = world.player!;
    const sim = tutorialPipeline({ read: () => ({ x: 1, y: 0 }) });
    const commands = new PlayerCommands(world);
    const stage = t.stages.find((s) => (s.useCount ?? 1) > 1)!;
    t.index = t.stages.indexOf(stage);
    sim.step(world, DT);
    commands.dash();
    run(sim, world, 0.5);
    expect(t.uses).toBe(1);
    expect(t.clearedAt).toBe(-1);
    commands.dash(); // still recharging: no second dash
    run(sim, world, 0.1);
    expect(t.uses).toBe(1);
    run(sim, world, P.frame.dashCd);
    commands.dash();
    run(sim, world, 0.5);
    expect(t.uses).toBe(stage.useCount);
    expect(t.clearedAt).toBeGreaterThanOrEqual(0);
  });

  it('rejects a stage that names an unknown class or forgets {keys}', () => {
    const raw = structuredClone(readRawData()) as unknown as GameData;
    raw.armies.tutorial.stages[0]!.text = 'Move.';
    raw.armies.tutorial.stages[1]!.spawn = [{ class: 'nobody', count: 2 }];
    expect(() => buildCatalog(raw as never)).toThrow(/text with keys must contain \{keys\}[\s\S]*unknown class "nobody"/);
  });
});
