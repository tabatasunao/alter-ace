import { describe, expect, it } from 'vitest';
import type { Point } from '../src/core/math';
import type { Catalog } from '../src/data/catalog';
import { buildCatalog } from '../src/data/load';
import type { GameData, ThrusterMovement } from '../src/data/types';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { PlayerMovementSystem } from '../src/sim/systems/PlayerMovementSystem';
import { arena, loadTestCatalog, readRawData } from './helpers';

const DT = 1 / 60;

/** An arena with the ace and a movement system driven by a mutable input vector. */
function rig(catalog: Catalog) {
  const world = arena(catalog);
  const input: Point = { x: 0, y: 0 };
  const move = new PlayerMovementSystem({ read: () => input });
  const P = world.player!;
  const steps = (seconds: number) => {
    for (let i = 0, n = Math.round(seconds / DT); i < n; i++) move.update(world, DT);
  };
  const speed = () => Math.hypot(P.vx, P.vy);
  return { world, P, input, steps, speed, top: P.frame.speed };
}

describe('thruster movement (default)', () => {
  const catalog = loadTestCatalog();
  const cfg = catalog.battle.player.movement as ThrusterMovement;
  /** Long enough to reach top speed from standstill. */
  const toTop = cfg.thrustTime + 0.25;
  /** Coasting time for a speed to decay to `to` (the model rests below 1 unit/s). */
  const coast = (from: number, to: number) => Math.log(from / to) / cfg.drag;

  it('is the configured model', () => {
    expect(cfg.model).toBe('thruster');
  });

  it('accelerates to top speed over thrustTime instead of instantly', () => {
    const { input, steps, speed, top } = rig(catalog);
    input.x = 1;
    steps(cfg.thrustTime / 2);
    expect(speed()).toBeCloseTo(top / 2, 0);
    steps(toTop);
    expect(speed()).toBeCloseTo(top, 6);
  });

  it('coasts when you let go, then comes to rest', () => {
    const { input, steps, speed, top } = rig(catalog);
    input.x = 1;
    steps(toTop);
    input.x = 0;
    steps(0.1);
    expect(speed()).toBeGreaterThan(top * 0.7);
    expect(speed()).toBeLessThan(top);
    steps(coast(top, 1) + 0.5);
    expect(speed()).toBe(0);
  });

  it('keeps momentum through a turn (drifts instead of snapping)', () => {
    const { P, input, steps, top } = rig(catalog);
    input.x = 1;
    steps(toTop);
    input.x = 0;
    input.y = 1;
    steps(0.1);
    expect(P.vx).toBeGreaterThan(top * 0.5);
    expect(P.vy).toBeGreaterThan(0);
  });

  it('bleeds off Overboost speed gradually when it ends', () => {
    const { P, input, steps, speed, top } = rig(catalog);
    P.statuses.push({ id: 'test', label: 'Test', remaining: 99, mods: { speed: 1.7 }, heal: 0, ring: true });
    input.x = 1;
    steps(toTop);
    expect(speed()).toBeCloseTo(top * 1.7, 6);
    P.statuses = [];
    steps(DT);
    expect(speed()).toBeGreaterThan(top);
    steps(coast(1.7, 1) + 0.5);
    expect(speed()).toBeCloseTo(top, 6);
  });

  it('carries momentum out of a dash', () => {
    const { world, P, input, steps, top } = rig(catalog);
    input.x = 1;
    steps(DT); // sets P.input, which the dash uses for its direction
    new PlayerCommands(world).dash();
    input.x = 0;
    steps(catalog.battle.player.dashDuration + DT);
    expect(P.dash).toBeNull();
    expect(P.vx).toBeGreaterThan(top * cfg.dashCarry * 0.9);
  });

  it('stops dead against a wall instead of sticking to it', () => {
    const { world, P, input, steps } = rig(catalog);
    P.x = catalog.battle.player.edgeMargin + 1;
    P.vx = -P.frame.speed;
    steps(DT);
    expect(P.x).toBe(catalog.battle.player.edgeMargin);
    expect(P.vx).toBe(0);
    input.x = 1;
    steps(0.05);
    expect(P.vx).toBeGreaterThan(0);
    expect(world.status.over).toBe(false);
  });
});

describe('direct movement (selectable in data)', () => {
  const raw = structuredClone(readRawData()) as unknown as GameData;
  raw.battle.player.movement = { model: 'direct', response: 12 };
  const catalog = buildCatalog(raw as never);

  it('reaches top speed almost at once and stops almost at once', () => {
    const { input, steps, speed, top } = rig(catalog);
    input.x = 1;
    steps(0.3);
    expect(speed()).toBeGreaterThan(top * 0.95);
    input.x = 0;
    steps(0.3);
    expect(speed()).toBeLessThan(top * 0.05);
  });
});
