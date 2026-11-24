import { describe, expect, it } from 'vitest';
import { segmentDistance } from '../src/core/math';
import { SeededRandom } from '../src/core/random';
import { ALLY, ENEMY, type Unit } from '../src/sim/entities';
import { World } from '../src/sim/World';
import { loadTestCatalog } from './helpers';

describe('SpatialGrid', () => {
  const catalog = loadTestCatalog();
  const world = new World(catalog, new SeededRandom(5), 'demo');
  const r = new SeededRandom(99);
  const trooper = catalog.unitClass('trooper');
  for (let i = 0; i < 600; i++) {
    const u = world.factory.soldier(trooper, r.chance(0.5) ? ALLY : ENEMY, r.range(0, world.width), r.range(0, world.height));
    if (r.chance(0.05)) u.alive = false;
    world.units.push(u);
  }
  world.grid.rebuild(world.units);

  it('eachNear visits every unit within the radius', () => {
    for (let q = 0; q < 100; q++) {
      const x = r.range(-100, world.width + 100);
      const y = r.range(-100, world.height + 100);
      const radius = r.range(20, 900);
      const seen = new Set<Unit>();
      world.grid.eachNear(x, y, radius, (u) => seen.add(u));
      for (const u of world.units) {
        if (Math.hypot(u.x - x, u.y - y) <= radius) expect(seen.has(u)).toBe(true);
      }
    }
  });

  it('forEachNearSegment visits every unit near the line, each once, and only a thin band of cells', () => {
    for (let q = 0; q < 200; q++) {
      const ax = r.range(0, world.width);
      const ay = r.range(0, world.height);
      // Every direction, including exactly vertical and horizontal lines and zero length.
      const a = q % 20 === 0 ? Math.PI / 2 : q % 20 === 1 ? 0 : r.range(0, Math.PI * 2);
      const len = q % 20 === 2 ? 0 : r.range(50, 900);
      const bx = ax + Math.cos(a) * len;
      const by = ay + Math.sin(a) * len;
      const pad = r.range(5, 30);
      const visits = new Map<Unit, number>();
      world.grid.forEachNearSegment(ax, ay, bx, by, pad, (u) => visits.set(u, (visits.get(u) ?? 0) + 1));
      for (const u of world.units) {
        if (segmentDistance(u.x, u.y, ax, ay, bx, by) <= pad) expect(visits.has(u)).toBe(true);
      }
      expect([...visits.values()].every((n) => n === 1)).toBe(true);
      // Far fewer candidates than the whole field (600 units).
      expect(visits.size).toBeLessThan(200);
    }
  });

  it('nearestHostile matches a brute-force search', () => {
    for (let q = 0; q < 100; q++) {
      const x = r.range(0, world.width);
      const y = r.range(0, world.height);
      const team = r.chance(0.5) ? ALLY : ENEMY;
      const maxR = r.range(50, 900);
      let best: Unit | null = null;
      let bestD = maxR * maxR;
      for (const u of world.units) {
        const d = (u.x - x) ** 2 + (u.y - y) ** 2;
        if (u.team !== team && u.alive && d < bestD) {
          bestD = d;
          best = u;
        }
      }
      const found = world.grid.nearestHostile(x, y, team, maxR);
      if (best === null) expect(found).toBeNull();
      else expect(Math.hypot(found!.x - x, found!.y - y)).toBeCloseTo(Math.sqrt(bestD), 6);
    }
  });

  it('clusterAt counts enemies in the surrounding 3×3 cells', () => {
    const cell = world.grid.cellOf(3000, 1700);
    const cs = catalog.battle.world.cellSize;
    const cx = cell % world.grid.cols;
    const cy = Math.floor(cell / world.grid.cols);
    const expected = world.units.filter((u) => {
      if (u.team !== ENEMY) return false;
      const ux = Math.min(world.grid.cols - 1, Math.floor(u.x / cs));
      const uy = Math.min(world.grid.rows - 1, Math.floor(u.y / cs));
      return Math.abs(ux - cx) <= 1 && Math.abs(uy - cy) <= 1;
    }).length;
    expect(world.grid.clusterAt(cell)).toBe(expected);
  });
});
