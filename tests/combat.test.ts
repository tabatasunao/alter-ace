import { describe, expect, it } from 'vitest';
import { ALLY, ENEMY } from '../src/sim/entities';
import { aceHit, addSoldier, ARMY_HIT, arena, loadTestCatalog } from './helpers';
import { tm } from '../src/i18n';

describe('Combat', () => {
  const catalog = loadTestCatalog();
  const { balance } = catalog.battle;

  it('softens damage between AI units but not from the ace', () => {
    const world = arena(catalog);
    const a = addSoldier(world, 'striker', ENEMY, 3000, 1000);
    const b = addSoldier(world, 'striker', ENEMY, 3100, 1000);
    world.combat.damage(a, 10, ARMY_HIT);
    world.combat.damage(b, 10, aceHit(catalog, 'rail'));
    expect(a.hp).toBeCloseTo(a.maxHp - 10 * balance.unitVsUnit);
    expect(b.hp).toBe(b.maxHp - 10);
  });

  it('makes normal ALTERs take extra damage from the ace and semi-aces, but not from the rest of the army', () => {
    const world = arena(catalog);
    const mul = catalog.unitClass('trooper').aceHitMul!;
    const fromAce = addSoldier(world, 'trooper', ENEMY, 3000, 1000);
    const fromSemiAce = addSoldier(world, 'beamTrooper', ENEMY, 3100, 1000);
    const fromArmy = addSoldier(world, 'trooper', ENEMY, 3200, 1000);
    world.combat.damage(fromAce, 10, aceHit(catalog, 'rail'));
    world.combat.damage(fromSemiAce, 10, { ...ARMY_HIT, semiAce: true });
    world.combat.damage(fromArmy, 10, ARMY_HIT);
    expect(fromAce.maxHp - fromAce.hp).toBeCloseTo(10 * mul);
    expect(fromSemiAce.maxHp - fromSemiAce.hp).toBeCloseTo(10 * balance.unitVsUnit * mul);
    expect(fromArmy.maxHp - fromArmy.hp).toBeCloseTo(10 * balance.unitVsUnit);
  });

  it('scales damage to the ace, honors statuses and invulnerability, and tracks it', () => {
    const world = arena(catalog);
    const P = world.player!;
    world.combat.damage(P, 100, ARMY_HIT);
    expect(P.hp).toBeCloseTo(P.maxHp - 100 * balance.aceDamageTaken);
    P.statuses.push({ id: 'test', remaining: 1, mods: { damageTaken: 0.5 }, ring: false });
    world.combat.damage(P, 100, ARMY_HIT);
    expect(world.stats.dmgTaken).toBeCloseTo(100 * balance.aceDamageTaken * 1.5);
    P.iframes = 1;
    const before = P.hp;
    world.combat.damage(P, 100, ARMY_HIT);
    expect(P.hp).toBe(before);
  });

  it('credits ace kills per weapon and counts losses on both sides', () => {
    const world = arena(catalog);
    const enemy = addSoldier(world, 'trooper', ENEMY, 3000, 1000);
    const ally = addSoldier(world, 'trooper', ALLY, 1000, 1000);
    const field = world.stats.enemyField;
    const allies = world.stats.allyAlive;
    world.combat.damage(enemy, 1000, aceHit(catalog, 'rail'));
    world.combat.damage(ally, 1e6, ARMY_HIT);
    expect(world.stats.kills).toBe(1);
    expect(world.stats.killsBy).toEqual({ rail: 1 });
    expect(world.stats.enemyField).toBe(field - 1);
    expect(world.stats.allyAlive).toBe(allies - 1);
  });

  it('announces a Commander kill', () => {
    const world = arena(catalog);
    const banners: string[] = [];
    world.events.on('banner', ({ msg }) => banners.push(tm(msg)));
    world.combat.damage(addSoldier(world, 'commander', ENEMY, 3000, 1000), 1e6, aceHit(catalog, 'rail'));
    expect(banners).toContain('Enemy Commander down');
  });

  it('ends the battle in defeat when the ace dies', () => {
    const world = arena(catalog);
    const ended: boolean[] = [];
    world.events.on('battleEnded', ({ win }) => ended.push(win));
    world.combat.damage(world.player!, 1e6, ARMY_HIT);
    expect(world.status.over).toBe(true);
    expect(ended).toEqual([false]);
  });

  it('explodes with falloff to half damage at the edge, sparing its own team', () => {
    const world = arena(catalog);
    const center = addSoldier(world, 'bulwark', ENEMY, 3000, 1000);
    const edge = addSoldier(world, 'bulwark', ENEMY, 3000 + 100 + center.size / 2, 1000);
    const friend = addSoldier(world, 'bulwark', ALLY, 3000, 1050);
    world.combat.explode(3000, 1000, 100, 40, ALLY, aceHit(catalog, 'bazooka'));
    expect(center.maxHp - center.hp).toBeCloseTo(40);
    expect(edge.maxHp - edge.hp).toBeCloseTo(20);
    expect(friend.hp).toBe(friend.maxHp);
  });
});
