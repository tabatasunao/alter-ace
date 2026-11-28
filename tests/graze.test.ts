import { describe, expect, it } from 'vitest';
import { launchShot, lineStrike } from '../src/sim/attacks';
import { ENEMY, type Hit } from '../src/sim/entities';
import { Simulation } from '../src/sim/System';
import { GrazeSystem } from '../src/sim/systems/GrazeSystem';
import { GridSystem } from '../src/sim/systems/GridSystem';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { arena, loadTestCatalog } from './helpers';

const HIT = { src: 'army', dtype: 'kinetic' } as Hit;
const SHOT = { kind: 'bullet', speed: 900, dmg: 10, life: 2, r: 3 } as const;

/** The ace alone with an empty gauge, and a sim with just shots and grazes (no per-second charge). */
function setup() {
  const world = arena(loadTestCatalog());
  const P = world.player!;
  P.releaseCharge = 0;
  const charge = world.catalog.battle.player.superRelease.charge;
  const sim = new Simulation([new GridSystem(), new ProjectileSystem(), new GrazeSystem()]);
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) sim.step(world, 1 / 60);
  };
  /** A shot flying east that passes `edge` units from the ace's hull (0 or less: straight at it). */
  const shotPast = (edge: number) => launchShot(world, ENEMY, P.x - 400, P.y + (edge > 0 ? P.size / 2 + SHOT.r + edge : 0), 0, HIT, SHOT);
  return { world, P, charge, run, shotPast };
}

describe('Full Arms charge from damage and near misses', () => {
  it('charges by the share of max HP lost to a hit', () => {
    const { world, P, charge } = setup();
    const dealt = world.combat.damage(P, P.maxHp * 0.4, HIT);
    expect(dealt).toBeGreaterThan(0);
    expect(P.releaseCharge).toBeCloseTo((dealt / P.maxHp) * charge.perHpTaken);
  });

  it('counts an enemy shot that passes close by, once', () => {
    const { P, charge, run, shotPast } = setup();
    shotPast(charge.graze.radius / 2);
    run(1.5);
    expect(P.releaseCharge).toBeCloseTo(charge.graze.perShot);
    expect(P.hp).toBe(P.maxHp);
  });

  it('ignores a shot that passes outside the graze radius', () => {
    const { P, charge, run, shotPast } = setup();
    shotPast(charge.graze.radius + 10);
    run(1.5);
    expect(P.releaseCharge).toBe(0);
  });

  it('gives a shot that hits only the damage charge, not a graze', () => {
    const { world, P, charge, run, shotPast } = setup();
    shotPast(0);
    run(1.5);
    expect(world.stats.dmgTaken).toBeGreaterThan(0);
    expect(P.releaseCharge).toBeCloseTo((world.stats.dmgTaken / P.maxHp) * charge.perHpTaken);
  });

  it('counts a line attack that just misses the ace', () => {
    const { world, P, charge } = setup();
    const width = 10;
    const offset = P.size / 2 + width / 2 + charge.graze.radius / 2;
    lineStrike(world, { x: P.x - 300, y: P.y + offset, team: ENEMY }, 0, { range: 900, width, dmg: 50, lineWidth: 6 }, HIT, 'enemy');
    expect(P.hp).toBe(P.maxHp);
    expect(P.releaseCharge).toBeCloseTo(charge.graze.perLine);
  });

  it('does not charge while Full Arms runs', () => {
    const { world, P, run, shotPast, charge } = setup();
    P.release = { elapsed: 0, duration: 3, killsAtStart: 0 };
    shotPast(charge.graze.radius / 2);
    run(1.5);
    world.combat.damage(P, 10, HIT);
    expect(P.releaseCharge).toBe(0);
  });
});
