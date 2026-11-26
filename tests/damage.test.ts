import { describe, expect, it } from 'vitest';
import { ENEMY, type Hit } from '../src/sim/entities';
import { armorLine, matchupLine, unitWeaponLine } from '../src/ui/damageText';
import { aceHit, addSoldier, ARMY_HIT, arena, loadTestCatalog } from './helpers';

describe('damage types and armor', () => {
  const catalog = loadTestCatalog();

  /** HP a unit of `classId` loses to a 100-damage hit, and the armor markers it leaves. */
  function hit(classId: string, weaponOrHit: string | Hit) {
    const world = arena(catalog);
    const u = addSoldier(world, classId, ENEMY, 3000, 1000);
    u.hp = u.maxHp = 1000;
    world.combat.damage(u, 100, typeof weaponOrHit === 'string' ? aceHit(catalog, weaponOrHit) : weaponOrHit);
    return { lost: 1000 - u.hp, markers: world.fx.filter((f) => f.type === 'hitMarker') };
  }

  it('scales the ace hits by the weapon type against the armor', () => {
    expect(hit('bulwark', 'rifle').lost).toBe(50); // kinetic vs heavy plate
    expect(hit('bulwark', 'beamRifle').lost).toBe(150); // beam vs heavy plate
    expect(hit('prism', 'saber').lost).toBe(50); // beam vs beam coating
    expect(hit('prism', 'mortar').lost).toBe(150); // blast vs beam coating
    expect(hit('breacher', 'missile').lost).toBe(50); // blast vs reactive armor
    expect(hit('breacher', 'gatling').lost).toBe(150); // kinetic vs reactive armor
    expect(hit('striker', 'rail').lost).toBe(100); // standard armor
  });

  it("applies armor to the armies' fire too, without markers", () => {
    const { unitVsUnit } = catalog.battle.balance;
    const beam = { ...ARMY_HIT, dtype: 'beam' };
    expect(hit('bulwark', beam).lost).toBeCloseTo(100 * unitVsUnit * 1.5);
    expect(hit('prism', beam).lost).toBeCloseTo(100 * unitVsUnit * 0.5);
    expect(hit('bulwark', ARMY_HIT).lost).toBeCloseTo(100 * unitVsUnit);
    expect(hit('bulwark', beam).markers).toEqual([]);
  });

  it('marks critical and resisted hits with their damage type, but not normal ones', () => {
    expect(hit('bulwark', 'beamRifle').markers).toEqual([expect.objectContaining({ result: 'critical', dtype: 'beam', label: true })]);
    expect(hit('bulwark', 'rifle').markers).toEqual([expect.objectContaining({ result: 'resisted', dtype: 'kinetic' })]);
    expect(hit('striker', 'rifle').markers).toEqual([]);
  });

  it('shows a hit label over a unit at most once in a while, so rapid fire does not stack text', () => {
    const world = arena(catalog);
    const u = addSoldier(world, 'bulwark', ENEMY, 3000, 1000);
    u.hp = u.maxHp = 1e6;
    const beam = aceHit(catalog, 'beamRifle');
    const labels = () => world.fx.filter((f) => f.type === 'hitMarker' && f.label).length;
    world.combat.damage(u, 1, beam);
    u.flash = 0; // as if the hit flash had worn off
    world.t += 0.1;
    world.combat.damage(u, 1, beam);
    expect(world.fx.filter((f) => f.type === 'hitMarker')).toHaveLength(2);
    expect(labels()).toBe(1);
    u.flash = 0;
    world.t += 0.5;
    world.combat.damage(u, 1, beam);
    expect(labels()).toBe(2);
  });

  it('applies armor to splash damage too', () => {
    const world = arena(catalog);
    const plated = addSoldier(world, 'bulwark', ENEMY, 3000, 1000);
    const reactive = addSoldier(world, 'breacher', ENEMY, 3000, 1000);
    plated.hp = plated.maxHp = reactive.hp = reactive.maxHp = 1000;
    // Both sit at the blast center, so each takes the full 100 before armor.
    world.combat.explode(3000, 1000, 50, 100, 0, aceHit(catalog, 'mortar'));
    expect(1000 - plated.hp).toBe(100); // blast vs heavy plate: normal
    expect(1000 - reactive.hp).toBe(50); // blast vs reactive armor: halved
  });

  it('describes matchups for weapon cards and the legend', () => {
    expect(matchupLine(catalog, 'kinetic')).toBe('Strong vs Reactive armor · Weak vs Heavy plate');
    expect(armorLine(catalog, 'standard')).toBe('Standard armor');
    expect(armorLine(catalog, 'plate')).toMatch(/^Heavy plate: weak to .*Beam.*, resists .*Kinetic/);
    const trooper = catalog.unitClass('trooper');
    expect(unitWeaponLine(catalog, trooper)).toMatch(/^Assault rifle \(.*Kinetic.*\)$/);
  });
});
