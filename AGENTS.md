# AGENTS.md

Instructions for AI coding agents and human contributors.

## Project

- **What:** ALTER, a top-down 2D real-time mass battle game for the browser. One player-controlled ace and 100 allied AI units against 300–600 enemy AI units.
- **Stack:** TypeScript, 2D canvas, Vite (bundler), Vitest (tests). No runtime dependencies.
- **Requires:** Node.js 22.12 or newer.
- **Game rules:** [docs/mechanics.md](docs/mechanics.md). **Code structure and recipes:** [docs/architecture.md](docs/architecture.md). **Data fields:** [docs/data.md](docs/data.md).

## Commands

| Command | Effect | When |
| --- | --- | --- |
| `npm install` | Install dev dependencies | Once |
| `npm run dev` | Dev server at http://localhost:5173 with hot reload, including data files | Development |
| `npm test` | All tests, headless (a few seconds) | Before every commit |
| `npm run test:watch` | Tests in watch mode | Development |
| `npm run typecheck` | `tsc --noEmit` | Before every commit |
| `npm run docs` | Regenerate `docs/reference.md` from `public/data/*.json` | After any data change |
| `npm run build` | Typecheck, then production build into `dist/` | Before release |
| `npm run preview` | Serve `dist/` | Checking a build |

## Repository map

```
public/data/          all gameplay numbers (JSON)
public/audio/         sound effects and music (CC0; sources in public/licenses/AUDIO.md)
src/
  main.ts             boot: load and validate data, start App, dev hooks
  app/                App (composition root, screen flow), GameLoop
  core/               math, SeededRandom, EventBus, time stepper
  data/               types.ts (data shape), validate.ts, Catalog, load.ts
  sim/                headless battle simulation
    World.ts          all battle state
    pipelines.ts      system order
    systems/          one System per job
    weapons/          ace weapon behaviors (registry.ts)
    ai/               AI targeting, leash, intercept aim, unit weapon behaviors (ai/weapons)
    targeting/        aim mode strategies
    projectiles/      projectile motions
    movement/         ace movement models
    damageRules.ts    hit modifiers per unit kind
    attacks.ts        attack shapes shared by the ace and the AI
    statuses.ts       ace timed effects
    SpatialGrid.ts    spatial queries
  i18n/               languages: locales/*.json string tables, t()/tm(), data-file text (data.ts), page text (static.ts)
  render/             canvas renderer: layers/ (order) and painters/ (drawing)
  audio/              sound effects and music (sounds.ts lists them; files in public/audio)
  ui/                 DOM views: hangar, HUD, result, pause, options, banner, launch sequence
  input/              keyboard and key map, touch joystick, wheel
  game/               loadout model and storage, sortie rating, career (bests, medals), defeat tips, settings
  style.css           styles and color tokens
tests/                Vitest tests against the real data files
  helpers.ts          battle(), arena(), addSoldier()
  balance/            weapon bench used by balance.test.ts
  docs/               reference page generator (npm run docs)
docs/                 documentation (index: docs/README.md)
```

## Rules

1. **Tuning values go in `public/data/*.json`**, with the matching type in `src/data/types.ts`. Visual constants and small implementation constants (spawn offsets, burst scatter, label throttling) may stay next to the code that uses them.
2. **Extend with strategies, not switches.** Weapons (`behavior`), unit weapons (`behavior`), aim modes (`strategy`), unit looks (`shape`), projectile motions and looks, effects, and movement models each have a typed registry. A new variant is a new implementation plus a registry entry. Do not add `if (id === '...')` branches in systems. Inside the sim the same applies to damage modifiers (`DAMAGE_RULES`), timed unit behavior (`UnitAction`), ace buffs (`Status`) and shared attack shapes (`src/sim/attacks.ts`).
3. **`src/sim` is headless:** no DOM, canvas or `window`. It communicates out through `world.events` (`GameEvents`) and in through `MoveInput` and `PlayerCommands`.
4. **All simulation randomness goes through `world.random`.** Never `Math.random()` in `src/sim`. Object property order in `UnitFactory` fixes the order of random draws.
5. **New mechanics are new `System`s** in `src/sim/pipelines.ts`, one job each.
6. **Rendering reads the World and never mutates it.** The sim assigns a semantic `Tone`; colors come from CSS tokens via `readPalette()`. No hex colors in `src/sim`.
7. **`App` is the only composition root.** Concrete classes are wired there.
8. **Per-unit cost.** A battle runs about 400 units and a few hundred shots. Code that runs every step queries `world.grid` (box, radius, nearest, segment) instead of looping over `world.units`. Layers skip off-screen objects (`UnitLayer`, `ShotLayer`). Performance changes are measured before and after.
9. **Semi-aces are enemy-only.** Validation rejects a `semiAce` class in `allyMix`, `minimums` or `fillerClass`.
10. **Docs describe the current game only.** Dry, factual, present tense. No tips, history or plans.
11. **Player-facing text is translated.** UI code uses `t('key')`, with the English in `src/i18n/locales/en.json` and the same key in `ja.json`, `zh.json` and `ko.json` (except `ENGLISH_ONLY` keys: the launch sequence is English in every language). The sim emits a `Message` (`msg(key, params)`) instead of a string. Data-file text is English, translated under keys like `weapon.<id>.desc`. Proper nouns stay English in every language: weapon, unit class, unit weapon and preset names (no keys), and Full Arms and semi-ace inside translations.

## Workflows

### Data change

1. Edit `public/data/*.json`.
2. `npm run docs` to regenerate `docs/reference.md`.
3. If a hand-written page states a value or behavior that changed (`docs/game.md`, `weapons.md`, `units.md`, `mechanics.md`, `data.md`), update it.
4. `npm test`. Commit the data and the regenerated page together.

### New variant (weapon behavior, aim mode, unit weapon, unit look, projectile, effect, movement model)

Follow the recipe in [docs/architecture.md](docs/architecture.md#recipes). TypeScript (for union-keyed registries) and the boot-time registry check report missing pieces. Add a test.

### New mechanic

Add a `System` to `battlePipeline()`, its numbers to the data, and a test. Player input: add a method to `PlayerCommands` and `CommandSink`. UI notification: add an event to `GameEvents`.

### Before finishing

- `npm run typecheck` passes.
- `npm test` passes.
- `npm run docs` produces no change to `docs/reference.md` (`npm test` fails otherwise).

## Testing

- Tests run against the real data files (`tests/helpers.ts`).
  - `battle(catalog, seed)`: a full sortie.
  - `arena(catalog)`: the ace only.
  - `addSoldier(world, classId, team, x, y)`: place a unit.
  - `loadFixtureCatalog()`: the real data plus test-only weapons (`tests/fixtures/extraWeapons.json`) for behaviors no current weapon uses.
- Every new behavior, effect or strategy gets a test.
- Float assertions: use binary-exact values (0.25, 0.125) or `toBeCloseTo`.
- Determinism: battles replay exactly from a seed (`tests/simulation.test.ts`). A change that must not alter gameplay can be checked by recording a few seeded battles before and after.

Checks that run on every `npm test`:

| Test file | Fails when |
| --- | --- |
| `tests/data.test.ts` | Data is invalid, names something unimplemented, or the default loadout is illegal |
| `tests/balance.test.ts` | A ranged weapon's damage output leaves 0.7×–1.5× of the median (melee: 0.7×–2.5×), or the exposure rules break ([architecture.md](docs/architecture.md#balance-test)) |
| `tests/docs.test.ts` | `docs/reference.md` does not match the data, a relative link or `#anchor` in the docs is broken, or a page in `docs/` is not linked from `docs/README.md` |
| `tests/simulation.test.ts` | Whole battles: deployment, reinforcements, victory, seeded replay |

Other test files: `load`, `heal`, `core`, `spatialGrid`, `combat`, `damage`, `weapons`, `superRelease`, `dodge`, `impact`, `praise`, `closeQuarters`, `aceCharges`, `mortarStun`, `weaponPersonality`, `unitWeapons`, `semiAces`, `aimModes`, `movement`, `loadout`, `settings`, `ui`, `i18n`, `audio`.

## Debugging

- `?seed=N` in the URL fixes the deployment. Each battle logs its seed to the console.
- In dev builds, `alter` in the browser console is the running `App`. `alter.debugWorld()` returns the live `World`.
- Background tabs pause `requestAnimationFrame`. To advance a battle manually: `alter.sim.step(alter.world, 1 / 60)`, then `alter.renderer.render(alter.world)`. These are internal fields, not an API.
- The dev server hot-reloads data. The console logs `[data] … reloaded`, or lists every problem in an invalid file.
- Headless tests with `arena()` reproduce most behavior without a browser.

## Documentation map

| Page | Owns |
| --- | --- |
| [README.md](README.md) | Project summary, play link, controls, build |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/game.md](docs/game.md) | Sortie flow, controls, hangar, HUD, visual legend, ranks |
| [docs/weapons.md](docs/weapons.md) | Hardpoints, weapons, frames, aim modes, damage types, Full Arms |
| [docs/units.md](docs/units.md) | Unit classes, AI behavior, stalking, deployment |
| [docs/mechanics.md](docs/mechanics.md) | Exact rules and formulas |
| [docs/reference.md](docs/reference.md) | Every value. Generated; do not edit |
| [docs/data.md](docs/data.md) | Data files and fields |
| [docs/architecture.md](docs/architecture.md) | Layers, pipeline, extension points, recipes, performance |
| [docs/glossary.md](docs/glossary.md) | Terms |

## Build and deploy

- `npm run build` writes `dist/` (`index.html`, hashed `assets/`, `data/`). The base path is relative, so the build works from any sub-path of a web server. It does not run from `file://`.
- `.github/workflows/pages.yml` runs tests and build (which typechecks) on Node 22 and 24 for every pull request and push. A push to `main` also deploys the build to GitHub Pages.
- Link previews: `index.html` carries Open Graph and Twitter card tags pointing at `public/og.jpg` (1200×630). Crawlers need absolute URLs, so those tags name `https://tabatasunao.github.io/alter-ace/`; they change if the site moves.
