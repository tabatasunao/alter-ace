import { describe, expect, it } from 'vitest';
import type { GameData } from '../src/data/types';
import { validateGameData } from '../src/data/validate';
import { ALLY, ENEMY } from '../src/sim/entities';
import { HealSystem } from '../src/sim/systems/HealSystem';
import type { World } from '../src/sim/World';
import { addSoldier, arena, loadTestCatalog, readRawData } from './helpers';

describe('healer', () => {
  const catalog = loadTestCatalog();
  const heal = catalog.unitClass('healer').heal!;
  const pulse = (world: World) => {
    for (const u of world.units) if (u.kind === 'soldier' && u.def.heal) u.healT = 0;
    new HealSystem().update(world, 1 / 60);
  };

  it('heals units of its army within range by a share of their max HP, up to full', () => {
    const world = arena(catalog);
    const healer = addSoldier(world, 'healer', ENEMY, 3000, 1000);
    const near = addSoldier(world, 'bulwark', ENEMY, 3000 + heal.radius - 20, 1000);
    const almostFull = addSoldier(world, 'trooper', ENEMY, 3000, 1050);
    const far = addSoldier(world, 'trooper', ENEMY, 3000 + heal.radius + 100, 1000);
    const hostile = addSoldier(world, 'trooper', ALLY, 3000, 950);
    near.hp = 100;
    almostFull.hp = almostFull.maxHp - 1;
    far.hp = hostile.hp = 10;
    pulse(world);
    expect(near.hp).toBeCloseTo(100 + near.maxHp * heal.amount);
    expect(almostFull.hp).toBe(almostFull.maxHp);
    expect(far.hp).toBe(10);
    expect(hostile.hp).toBe(10);
    expect(healer.healT).toBeCloseTo(heal.interval - 1 / 60);
    expect(world.fx).toContainEqual(expect.objectContaining({ type: 'pulse', r: heal.radius, tone: 'enemy' }));
  });

  it('pulses once per interval', () => {
    const world = arena(catalog);
    const healer = addSoldier(world, 'healer', ALLY, 3000, 1000);
    const hurt = addSoldier(world, 'bulwark', ALLY, 3050, 1000);
    hurt.hp = 10;
    healer.healT = 0.5;
    const system = new HealSystem();
    const step = () => system.update(world, 0.25);
    step();
    expect(hurt.hp).toBe(10);
    step();
    const once = hurt.hp;
    expect(once).toBeGreaterThan(10);
    for (let i = 0; i < Math.round(heal.interval / 0.25) - 1; i++) step();
    expect(hurt.hp).toBe(once);
    step();
    expect(hurt.hp).toBeGreaterThan(once);
  });

  it('allied healers heal the ace; enemy healers do not', () => {
    const world = arena(catalog);
    const P = world.player!;
    P.hp = 10;
    addSoldier(world, 'healer', ENEMY, P.x + 50, P.y);
    pulse(world);
    expect(P.hp).toBe(10);
    addSoldier(world, 'healer', ALLY, P.x - 50, P.y);
    pulse(world);
    expect(P.hp).toBeCloseTo(10 + P.maxHp * heal.amount);
  });

  it('a stunned healer does not pulse', () => {
    const world = arena(catalog);
    const healer = addSoldier(world, 'healer', ENEMY, 3000, 1000);
    const hurt = addSoldier(world, 'bulwark', ENEMY, 3050, 1000);
    hurt.hp = 10;
    healer.healT = 0.1;
    healer.stunT = 1;
    new HealSystem().update(world, 0.5);
    expect(hurt.hp).toBe(10);
    expect(healer.healT).toBe(0.1);
  });

  it('rejects a broken heal and an unknown enemy weapon', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.units.classes.find((c) => c.id === 'healer')!.heal = { interval: 10, radius: 220, amount: 1.5 };
    broken.units.classes.find((c) => c.id === 'commander')!.enemyWeapon = 'nope';
    const errors = validateGameData(broken);
    expect(errors).toContain('units.healer.heal: need interval > 0, radius > 0 and 0 < amount <= 1');
    expect(errors).toContain('units.commander.enemyWeapon: unknown unit weapon "nope"');
  });
});
