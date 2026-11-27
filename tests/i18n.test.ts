import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actionList, sanitizeSettings } from '../src/game/settings';
import { detectLocale, ENGLISH_ONLY, LOCALES, setLocale, t, TABLES, td, tm, type Locale } from '../src/i18n';
import { dataStrings, dataText } from '../src/i18n/data';
import type { CommandSink } from '../src/input/commands';
import { KeyboardInput } from '../src/input/KeyboardInput';
import { KeyMap } from '../src/input/keymap';
import { defaultKeys } from '../src/game/settings';
import { launchAce } from '../src/sim/launch';
import { arena, loadTestCatalog } from './helpers';

const root = fileURLToPath(new URL('..', import.meta.url));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?\w+/g)].map((m) => m[0]).sort();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('languages', () => {
  const catalog = loadTestCatalog();
  const en = TABLES.en;
  const data = dataStrings(catalog);
  afterEach(() => setLocale('en'));

  it.each(LOCALES.filter((l) => l.id !== 'en').map((l) => [l.id] as const))('%s has every UI and data string, with the same placeholders and tags', (id) => {
    const table = TABLES[id as Locale];
    const source = Object.fromEntries(Object.entries({ ...en, ...data }).filter(([k]) => !ENGLISH_ONLY.test(k)));
    expect(Object.keys(table).sort()).toEqual(Object.keys(source).sort());
    for (const [key, text] of Object.entries(source)) {
      const v = table[key]!;
      expect(v.trim().length, key).toBeGreaterThan(0);
      expect(placeholders(v), key).toEqual(placeholders(text));
      expect(tags(v), key).toEqual(tags(text));
    }
  });

  it('has an English string for every key the code and the page use', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(root, 'src'))) {
      const s = readFileSync(file, 'utf8');
      for (const m of s.matchAll(/\b(?:t|msg)\('([\w.]+)'/g)) used.add(m[1]!);
      for (const m of s.matchAll(/'((?:hit|options\.hud|callout)\.[\w.]+)'/g)) used.add(m[1]!);
    }
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-html|-aria|-title)?="([\w.]+)"/g)) used.add(m[1]!);
    for (const a of actionList(4)) used.add(a.startsWith('slot:') ? 'action.slot' : `action.${a}`);
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('translates with placeholders, nested messages and data fallbacks; English fills gaps', () => {
    expect(t('hangar.slot.key', { n: 3 })).toBe('Key 3');
    expect(tm({ key: 'banner.hunt', params: { who: { key: 'banner.enemyUnit', params: { name: 'Circus' } } } })).toBe('Enemy Circus is hunting you');
    expect(tm({ key: 'unit.nobody.killBanner', fallback: 'From the data' })).toBe('From the data');
    setLocale('ja');
    expect(t('hangar.slot.key', { n: 3 })).toContain('3');
    expect(t('hangar.slot.key', { n: 3 })).not.toBe('Key 3');
    expect(td(`weapon.rail.desc`, 'Railgun')).toBe(TABLES.ja['weapon.rail.desc']);
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('keeps proper nouns in English: weapon, unit class, unit weapon and preset names', () => {
    for (const { id } of LOCALES) {
      setLocale(id);
      expect(catalog.weapons.map((w) => dataText.weaponName(w))).toEqual(catalog.weapons.map((w) => w.name));
      expect(catalog.classes.map((c) => dataText.unitName(c))).toEqual(catalog.classes.map((c) => c.name));
      expect(catalog.unitWeapons.map((w) => dataText.unitWeaponName(w))).toEqual(catalog.unitWeapons.map((w) => w.name));
      expect(dataText.presetName('Swift')).toBe('Swift');
      expect(Object.keys(TABLES[id]).filter((k) => /^(weapon|unit|unitWeapon|preset)\.[^.]+\.name$/.test(k))).toEqual([]);
    }
  });

  it('shows the launch sequence in English in every language', () => {
    const keys = Object.keys(en).filter((k) => ENGLISH_ONLY.test(k));
    expect(keys).toContain('launch.go');
    for (const { id } of LOCALES) {
      setLocale(id);
      for (const k of keys) expect(t(k), `${id} ${k}`).toBe(en[k]);
    }
  });

  it('follows the browser language when the settings name none', () => {
    expect(detectLocale(['ko-KR', 'en'])).toBe('ko');
    expect(detectLocale(['zh-CN'])).toBe('zh');
    expect(detectLocale(['fr', 'ja'])).toBe('ja');
    expect(detectLocale(['fr'])).toBe('en');
    expect(sanitizeSettings({ locale: 'ja' }, 4).locale).toBe('ja');
    expect(sanitizeSettings({ locale: 'xx' }, 4).locale).toBeNull();
  });
});

describe('launch sequence', () => {
  const catalog = loadTestCatalog();

  it('boosts the ace east past its top speed, with a shake and a flash', () => {
    const world = arena(catalog);
    const P = world.player!;
    launchAce(world);
    expect(P.vx).toBeCloseTo(P.frame.speed * catalog.battle.player.launch.speed);
    expect(P.vy).toBe(0);
    expect(world.impact.shake).toBe(catalog.battle.impact.launch.shake);
    expect(world.fx.filter((f) => f.type === 'ghost').length).toBeGreaterThan(0);
  });

  it('any key skips it', () => {
    const handlers: Record<string, (e: unknown) => void> = {};
    const target = { addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn) } as unknown as Window;
    const sink = {
      inputMode: () => 'launch',
      selectSlot: vi.fn(),
      setAimIndex: vi.fn(),
      cycleAim: vi.fn(),
      dash: vi.fn(),
      superRelease: vi.fn(),
      reload: vi.fn(),
      zoomBy: vi.fn(),
      togglePause: vi.fn(),
      confirm: vi.fn(),
      back: vi.fn(),
    } satisfies CommandSink;
    new KeyboardInput(sink, () => new KeyMap(defaultKeys(4), []), target);
    const press = (key: string, repeat = false) => handlers.keydown!({ key, repeat, target: null, preventDefault: () => {} });
    press(' ');
    press('Escape');
    press('a', true);
    expect(sink.confirm).toHaveBeenCalledTimes(2);
    expect(sink.superRelease).not.toHaveBeenCalled();
    expect(sink.togglePause).not.toHaveBeenCalled();
  });
});
