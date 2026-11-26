import { describe, expect, it } from 'vitest';
import { LoadoutEditor, sanitizeLoadout } from '../src/game/loadout';
import { loadTestCatalog } from './helpers';

describe('loadout', () => {
  const catalog = loadTestCatalog();

  it('falls back to the default for missing or junk saved data', () => {
    expect(sanitizeLoadout(null, catalog)).toEqual(catalog.loadout.defaultLoadout);
    const cleaned = sanitizeLoadout({ frame: 'nope', slots: ['rifle', 'rifle', 7, 'emp'], aim: 'cluster', enemies: 333 }, catalog);
    expect(cleaned).toEqual({ frame: 'vanguard', slots: ['rifle', 'emp'], aim: 'cluster', enemies: 350 });
  });

  it('refills the hardpoint of a weapon that no longer exists from the default loadout', () => {
    const d = catalog.loadout.defaultLoadout.slots;
    const cleaned = sanitizeLoadout({ frame: 'swift', slots: ['rifle', 'retiredGun', 'emp', 'decoy'], aim: 'closest', enemies: 450 }, catalog);
    const firstUnused = d.find((id) => !['rifle', 'emp', 'decoy'].includes(id))!;
    expect(cleaned.slots).toEqual(['rifle', 'emp', 'decoy', firstUnused]);
  });

  it('toggles items in and out and refuses a fifth', () => {
    const editor = new LoadoutEditor(catalog, sanitizeLoadout(null, catalog));
    expect(editor.toggle('gatling')).toBe('full');
    expect(editor.toggle('rifle')).toBe('removed');
    expect(editor.toggle('gatling')).toBe('added');
    expect(editor.value.slots).toEqual(['missile', 'breach', 'repair', 'gatling']);
  });

  it('requires every hardpoint filled and at least one weapon', () => {
    const editor = new LoadoutEditor(catalog, { frame: 'swift', slots: ['repair', 'emp', 'decoy'], aim: 'closest', enemies: 450 });
    expect(editor.check()).toEqual({ ok: false, message: 'Fill all 4 hardpoints (1 empty).' });
    editor.toggle('overboost');
    expect(editor.check().ok).toBe(false);
    editor.remove('overboost');
    editor.toggle('saber');
    expect(editor.check()).toEqual({ ok: true });
  });
});
