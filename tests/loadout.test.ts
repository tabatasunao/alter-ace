import { describe, expect, it } from 'vitest';
import { LoadoutEditor, NAME_MAX, pointsSpent, sanitizeBuild, sanitizeLoadout, sanitizeName } from '../src/game/loadout';
import { loadTestCatalog, presetBuild } from './helpers';
import { tm } from '../src/i18n';

describe('loadout', () => {
  const catalog = loadTestCatalog();

  it('falls back to the default for missing or junk saved data', () => {
    expect(sanitizeLoadout(null, catalog)).toEqual(catalog.loadout.defaultLoadout);
    const cleaned = sanitizeLoadout({ frame: 'nope', slots: ['rail', 'rail', 7, 'saber'], aim: 'cluster', enemies: 333 }, catalog);
    expect(cleaned).toEqual({ name: catalog.loadout.defaultLoadout.name, build: catalog.loadout.defaultLoadout.build, slots: ['rail', null, null, 'saber'], aim: 'cluster', enemies: 350 });
    expect(sanitizeLoadout({ slots: ['saber'] }, catalog).slots).toEqual(['saber', null, null, null]);
  });

  it('refills the hardpoint of a weapon that no longer exists from the default loadout', () => {
    const d = catalog.loadout.defaultLoadout.slots;
    const cleaned = sanitizeLoadout({ frame: 'swift', slots: ['rail', 'retiredGun', 'saber', 'sniper'], aim: 'closest', enemies: 450 }, catalog);
    const firstUnused = d.find((id) => !['rail', 'saber', 'sniper'].includes(id))!;
    expect(cleaned.slots).toEqual(['rail', firstUnused, 'saber', 'sniper']);
  });

  it('toggles items in and out in place, and refuses a fifth', () => {
    const editor = new LoadoutEditor(catalog, sanitizeLoadout(null, catalog));
    const [, b, c, d] = catalog.loadout.defaultLoadout.slots;
    expect(editor.toggle('saber')).toBe('full');
    expect(editor.toggle(catalog.loadout.defaultLoadout.slots[0]!)).toBe('removed');
    expect(editor.value.slots).toEqual([null, b, c, d]);
    expect(editor.toggle('saber')).toBe('added');
    expect(editor.value.slots).toEqual(['saber', b, c, d]);
    expect(editor.setup.slots).toEqual(['saber', b, c, d]);
  });

  it('requires every hardpoint filled', () => {
    const editor = new LoadoutEditor(catalog, { name: 'Test', build: presetBuild(catalog, 'Swift'), slots: ['saber', 'sniper', 'rail', null], aim: 'closest', enemies: 450 });
    const check = editor.check();
    expect(check.ok === false && tm(check.message)).toBe('Fill all 4 hardpoints (1 empty).');
    editor.toggle('shotgun');
    expect(editor.check()).toEqual({ ok: true });
    editor.remove('shotgun');
    expect(editor.check().ok).toBe(false);
  });

  it('turns an old saved frame into the preset of that name, and keeps a build within the points', () => {
    const fb = catalog.frameBuild;
    expect(sanitizeLoadout({ frame: 'quickdraw', slots: [] }, catalog).build).toEqual(presetBuild(catalog, 'Quickdraw'));
    const greedy = sanitizeBuild({ speed: 99, hp: 10, reload: 10, fireRate: 10, dash: 10 }, undefined, catalog);
    expect(greedy.speed).toBeLessThanOrEqual(fb.maxPerStat);
    expect(pointsSpent(greedy)).toBe(fb.points);
    expect(sanitizeBuild({ speed: 2.4, hp: -3 }, undefined, catalog)).toEqual({ speed: 2, hp: 0, reload: 0, fireRate: 0, dash: 0 });
  });

  it('spends frame points within each stat\'s cap and the points left', () => {
    const fb = catalog.frameBuild;
    const editor = new LoadoutEditor(catalog, { ...sanitizeLoadout(null, catalog), build: { speed: 0, hp: 0, reload: 0, fireRate: 0, dash: 0 } });
    expect(editor.pointsLeft).toBe(fb.points);
    expect(editor.setPoints('speed', fb.maxPerStat + 5)).toBe(true);
    expect(editor.value.build.speed).toBe(fb.maxPerStat);
    editor.setPoints('hp', fb.maxPerStat);
    editor.setPoints('dash', fb.maxPerStat); // only the points left
    expect(editor.pointsLeft).toBe(0);
    expect(editor.value.build.dash).toBe(fb.points - 2 * fb.maxPerStat);
    expect(editor.adjust('reload', 1)).toBe(false);
    expect(editor.adjust('speed', -1)).toBe(true);
    expect(editor.adjust('reload', 1)).toBe(true);
    editor.applyPreset('Vanguard');
    expect(editor.value.build).toEqual(presetBuild(catalog, 'Vanguard'));
  });

  it('makes a frame from a build and a name: values scale with points', () => {
    const fb = catalog.frameBuild;
    const max = fb.maxPerStat;
    const f = catalog.frameFor({ speed: max, hp: 0, reload: 0, fireRate: 0, dash: 0 }, 'Kestrel');
    expect(f.name).toBe('Kestrel');
    expect(f.speed).toBe(fb.stats.speed.max);
    expect(f.hp).toBe(fb.stats.hp.min);
    expect(catalog.frameStat('dash', max / 2)).toBeCloseTo((fb.stats.dash.min + fb.stats.dash.max) / 2);
  });

  it('cleans the ALTER name: no control characters, single spaces, at most 16 characters, never empty', () => {
    const fallback = catalog.loadout.defaultLoadout.name;
    expect(sanitizeName('  Night\u0007   Heron  ', catalog)).toBe('Night Heron');
    expect(sanitizeName('A'.repeat(40), catalog)).toHaveLength(NAME_MAX);
    expect(sanitizeName('   ', catalog)).toBe(fallback);
    expect(sanitizeName(42, catalog)).toBe(fallback);
    const editor = new LoadoutEditor(catalog, sanitizeLoadout(null, catalog));
    editor.setName('Kestrel');
    expect(editor.setup.name).toBe('Kestrel');
    expect(sanitizeLoadout({ name: '<b>Ace</b>' }, catalog).name).toBe('<b>Ace</b>'); // kept as text; the views escape it
  });
});
