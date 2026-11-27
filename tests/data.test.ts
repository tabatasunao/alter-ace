import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/data/load';
import type { GameData } from '../src/data/types';
import { validateGameData } from '../src/data/validate';
import { findMissingPainters } from '../src/render/registryCheck';
import { findMissingSimImplementations } from '../src/sim/registryCheck';
import { loadTestCatalog, readRawData } from './helpers';

describe('game data', () => {
  const catalog = loadTestCatalog();

  it('passes validation', () => {
    expect(validateGameData(catalog.data)).toEqual([]);
  });

  it('only names behaviors, effects, strategies and shapes that exist in code', () => {
    expect(findMissingSimImplementations(catalog)).toEqual([]);
    expect(findMissingPainters(catalog)).toEqual([]);
  });

  it('has frame presets that spend exactly the frame points', () => {
    for (const p of catalog.frameBuild.presets) {
      expect(Object.values(p.build).reduce((a, b) => a + b, 0), p.name).toBe(catalog.frameBuild.points);
    }
  });

  it('has the roster: a frame build with 3 presets, 6 weapons, 6 aim modes, 14 unit classes with 14 unit weapons, 3 damage types', () => {
    expect(catalog.frameBuild.presets).toHaveLength(3);
    expect(catalog.weapons).toHaveLength(6);
    expect(catalog.aimModes).toHaveLength(6);
    expect(catalog.classes).toHaveLength(14);
    expect(catalog.unitWeapons).toHaveLength(14);
    expect(catalog.damageTypes.map((t) => t.id)).toEqual(['kinetic', 'beam', 'blast']);
  });

  it('makes about half of each army normal ALTERs', () => {
    for (const mix of [catalog.armies.allyMix, catalog.armies.enemyMix]) {
      const named = Object.values(mix).reduce((a, b) => a + b, 0);
      const normal = (1 - named) + (mix.beamTrooper ?? 0); // the filler (Trooper) plus Beam Troopers
      expect(catalog.unitClass(catalog.armies.fillerClass).aceHitMul).toBeGreaterThan(1);
      expect(normal).toBeGreaterThan(0.45);
      expect(normal).toBeLessThan(0.55);
    }
  });

  it('arms both armies with every damage type, including beams', () => {
    const typesOf = (mix: Record<string, number>) =>
      new Set(
        [...Object.keys(mix), catalog.armies.fillerClass].map((id) => catalog.unitWeapon(catalog.unitClass(id).weapon).damageType),
      );
    expect(typesOf(catalog.armies.allyMix)).toEqual(new Set(['kinetic', 'beam', 'blast']));
    expect(typesOf(catalog.armies.enemyMix)).toEqual(new Set(['kinetic', 'beam', 'blast']));
  });

  it('rejects broken data with every problem listed', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.armies.enemyMix.striker = 0.9;
    broken.loadout.defaultLoadout.slots = ['rail', 'rail', 'sniper', 'repair'];
    broken.aimModes.modes[1]!.key = '5';
    const errors = validateGameData(broken);
    expect(errors.some((e) => e.includes('enemyMix'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown weapon "repair"'))).toBe(true);
    expect(errors.some((e) => e.includes('equipped twice'))).toBe(true);
    expect(errors.some((e) => e.includes('key "5"'))).toBe(true);
    expect(() => buildCatalog(broken as never)).toThrow(/Invalid game data/);
  });

  it('rejects unknown damage types and armor, and armor missing a damage type', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.weapons.weapons[0]!.damageType = 'sonic';
    broken.units.classes[0]!.armor = 'mithril';
    delete broken.damage.armor[1]!.vs.blast;
    const errors = validateGameData(broken);
    expect(errors).toContain('weapons.bazooka.damageType: unknown damage type "sonic"');
    expect(errors).toContain('units.trooper.armor: unknown armor "mithril"');
    expect(errors).toContain('damage.armor.plate.vs.blast must be a number >= 0');
  });

  it('rejects broken unit weapons', () => {
    const broken = structuredClone(readRawData()) as unknown as GameData;
    broken.units.classes[0]!.weapon = 'flamer';
    broken.units.classes.find((c) => c.id === 'striker')!.kiteDistance = -5;
    broken.units.classes.find((c) => c.id === 'beamTrooper')!.aceHitMul = 0;
    const lance = broken.unitWeapons.weapons.find((w) => w.id === 'beamLance')!;
    (lance as { lock: number }).lock = 5;
    broken.unitWeapons.weapons[0]!.damageType = 'sonic';
    const errors = validateGameData(broken);
    expect(errors).toContain('units.trooper.weapon: unknown unit weapon "flamer"');
    expect(errors).toContain('units.striker.kiteDistance must be > 0');
    expect(errors).toContain('units.beamTrooper.aceHitMul must be > 0');
    expect(errors).toContain('unitWeapons.beamLance: need charge > 0 and 0 <= lock < charge');
    expect(errors).toContain('unitWeapons.assaultRifle.damageType: unknown damage type "sonic"');
  });

  it('reports a unit weapon whose behavior has no implementation', () => {
    const raw = structuredClone(readRawData()) as unknown as GameData;
    (raw.unitWeapons.weapons[0] as { behavior: string }).behavior = 'flamer';
    expect(findMissingSimImplementations(buildCatalog(raw as never))).toEqual(['unit weapon "assaultRifle": no behavior "flamer"']);
  });

  it('reports a weapon whose behavior has no implementation', () => {
    const raw = structuredClone(readRawData()) as unknown as GameData;
    (raw.weapons.weapons[0] as { behavior: string }).behavior = 'plasmaWhip';
    expect(findMissingSimImplementations(buildCatalog(raw as never))).toEqual([
      'weapon "bazooka": no behavior "plasmaWhip"',
    ]);
  });
});
