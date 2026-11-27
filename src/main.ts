import { App } from './app/App';
import type { Catalog } from './data/catalog';
import { loadCatalog, onDataFileChanged } from './data/load';
import { LocalStorageCareerStore } from './game/career';
import { LocalStorageLoadoutStore } from './game/loadoutStore';
import { LocalStorageSettingsStore } from './game/settings';
import { findMissingPainters } from './render/registryCheck';
import { findMissingSimImplementations } from './sim/registryCheck';
// CJK fonts, split into character slices the browser loads only when a page needs them.
import '@fontsource-variable/m-plus-1-code/wght.css';
import '@fontsource-variable/noto-sans-sc/wght.css';
import '@fontsource/nanum-gothic-coding/korean-400.css';
import '@fontsource/nanum-gothic-coding/korean-700.css';
import './style.css';

const LOADOUT_KEY = 'alter-ace-loadout';
const CAREER_KEY = 'alter-ace-career';
const SETTINGS_KEY = 'alter-ace-settings';

/** Loads and checks data, including that every behavior/effect/strategy/shape it names exists in code. */
async function loadCheckedCatalog(): Promise<Catalog> {
  const catalog = await loadCatalog();
  const missing = [...findMissingSimImplementations(catalog), ...findMissingPainters(catalog)];
  if (missing.length) throw new Error(`Data refers to things the code doesn't implement:\n- ${missing.join('\n- ')}`);
  return catalog;
}

function seedFromUrl(): number | undefined {
  const seed = Number.parseInt(new URLSearchParams(location.search).get('seed') ?? '', 10);
  return Number.isFinite(seed) ? seed : undefined;
}

async function boot(): Promise<void> {
  const app = new App({
    catalog: await loadCheckedCatalog(),
    store: new LocalStorageLoadoutStore(LOADOUT_KEY),
    career: new LocalStorageCareerStore(CAREER_KEY),
    settings: new LocalStorageSettingsStore(SETTINGS_KEY),
    seed: seedFromUrl(),
  });
  app.start();

  // Dev only: `alter.debugWorld()` in the browser console returns the live World.
  if (import.meta.env.DEV) Object.assign(window, { alter: app });

  // Dev only: saving a file in public/data re-tunes the game without a reload.
  onDataFileChanged(async (file) => {
    try {
      app.setCatalog(await loadCheckedCatalog());
      console.info(`[data] ${file} reloaded`);
    } catch (err) {
      console.error(`[data] reload after ${file} failed:`, err);
    }
  });
}

boot().catch((err: unknown) => {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'fatal-error';
  box.textContent = `ALTER failed to start.\n\n${err instanceof Error ? err.message : String(err)}`;
  document.body.appendChild(box);
});
