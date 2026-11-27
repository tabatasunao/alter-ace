# Architecture

How the code is organized and how to extend it. The rules it implements are in [mechanics.md](mechanics.md); the data it loads is in [data.md](data.md); contributor rules and commands are in [AGENTS.md](../AGENTS.md).

## Layers

```
public/data/*.json      tuning data (no code)
        │
src/data         types, validation, Catalog (lookup by id)
        │
src/sim          headless simulation: World state + Systems + strategies      ← no DOM, no canvas
        │  events (banner, battleEnded, slotDenied, actionDenied, demoExhausted)
        ▼
src/i18n         languages: string tables, t() / tm() lookups, data-file text, page text
src/render       canvas layers and painters (reads World, never changes it)
src/ui           DOM views: hangar, HUD, result, pause, options, banner, launch sequence
src/input        keyboard (through the KeyMap), touch joystick, wheel → CommandSink / MoveInput
src/game         loadout model and storage, sortie rating, career (bests, medals), defeat tips, settings (no DOM)
src/app          App: composition root and screen flow; GameLoop
src/main.ts      boot: load and validate data, start the App, data hot reload (dev)
```

Dependencies point downward only. `src/sim` does not import `render`, `ui`, `input` or `app`, so a whole battle runs in Vitest (`tests/simulation.test.ts`).

## One frame

`GameLoop` (requestAnimationFrame) → `TimeStepper.advance` → `Simulation.step(world, dt)` runs the systems in pipeline order → `CanvasRenderer.render(world)` runs the layers → `HudView.update(world)`.

`Simulation.step` honors `world.impact`: during hit-stop it runs only systems with `duringFreeze` (`EffectSystem`, `ImpactSystem`, the camera systems); during slow motion it scales `dt`. Input commands arrive between steps, after `CleanupSystem` has compacted `world.units`, so `PlayerCommands` rebuilds the spatial grid before a command that queries it.

`VariableStep` (one step per frame, `dt` capped at 0.05 s) implements `TimeStepper`.

## Battle pipeline

`battlePipeline()` in `src/sim/pipelines.ts`:

| # | System | Job |
| -: | --- | --- |
| 1 | `GridSystem` | Rebuild the spatial grid |
| 2 | `SeparationSystem` | Push overlapping units apart |
| 3 | `CentroidSystem` | Average position of each army |
| 4 | `AuraSystem` | Commander fire-rate aura |
| 5 | `HealSystem` | Heal pulses (classes with `heal`) |
| 6 | `ShieldSystem` | Shield timers (the `shield` damage rule raises a shield on a hit) |
| 7 | `PlayerStatusSystem` | Ace timers, statuses, regeneration, close-dodge window |
| 8 | `ReleaseSystem` | Full Arms gauge over time, Full Arms end |
| 9 | `PlayerMovementSystem` | Steering, dash, saber lunge, walls |
| 10 | `PlayerWeaponSystem` | Reloads, reticle, automatic fire (every weapon during Full Arms) |
| 11 | `StalkSystem` | Enemy Duelists (classes with `nearAce`) that find the ace start stalking and rally packs; packs disband when the leader dies |
| 12 | `SoldierAISystem` | Target selection, approach / kite / strafe, leashes, firing |
| 13 | `UnitActionSystem` | Step unit actions (lance charges, saber lunges) |
| 14 | `ProjectileSystem` | Move shots, resolve hits and splash |
| 15 | `EffectSystem` | Age visual effects (also during hit-stop) |
| 16 | `ImpactSystem` | Settle shake and flash, count down the hit-stop gap (also during hit-stop) |
| 17 | `BattleClockSystem` | Battle timer |
| 18 | `ReinforcementSystem` | Enemy battalions from the east edge |
| 19 | `AlertSystem` | One-time banners |
| 20 | `PraiseSystem` | Kill milestone and streak banners |
| 21 | `VictorySystem` | Victory when no enemies remain |
| 22 | `CleanupSystem` | Remove dead units |
| 23 | `FollowCameraSystem` | Camera follows the ace (also during hit-stop) |

`demoPipeline()` (hangar skirmish) runs the same systems except the ace systems (statuses, Full Arms, movement, weapons), `StalkSystem`, `ImpactSystem`, `BattleClockSystem`, `ReinforcementSystem`, `AlertSystem`, `PraiseSystem`, `VictorySystem` and `FollowCameraSystem`, and adds `DemoDirectorSystem` and `DemoCameraSystem`.

## Extension points

Every variant is a **strategy in a typed registry**, selected by name from the data. Adding a variant means adding an implementation and a registry entry; the systems that use it do not change.

| Variant | Data field | Registry / list |
| --- | --- | --- |
| Ace weapon behavior | `weapons.json` → `behavior` | `src/sim/weapons/registry.ts` |
| AI unit weapon behavior | `unitWeapons.json` → `behavior` | `src/sim/ai/weapons/registry.ts` |
| Aim mode | `aimModes.json` → `strategy` | `AIM_STRATEGIES` in `src/sim/targeting/aimStrategies.ts` |
| Ace movement model | `battle.json` → `player.movement.model` | `src/sim/movement/registry.ts` |
| Unit look | `units.json` → `shape`, `enemyShape` | `src/render/painters/unitPainters.ts` (`unitShape` picks the look for a unit's army) |
| Ace weapon aim feedback | `weapons.json` → `behavior` | `createWeaponOverlays` in `src/render/painters/weaponOverlays.ts` (optional per behavior: reticle brackets, a mark on the target, a gauge by the ace; the Railgun's steady aim and the Sniper Rifle's sight line) |
| Projectile motion / look | `Projectile['kind']` | `src/sim/projectiles/motions.ts`, `src/render/painters/shotPainters.ts` |
| Visual effect | `Effect['type']` | `src/render/painters/effectPainters.ts` |
| Damage modifier | – | `DAMAGE_RULES` in `src/sim/damageRules.ts`, per unit kind |
| Timed unit behavior | – | `UnitAction` in `unit.action`, run by `UnitActionSystem` |
| Ace buff | – | `Status` in `Player.statuses` (`src/sim/statuses.ts`); read with `statMul(P, stat)` |
| Attack shape | – | `src/sim/attacks.ts` (`arcSlash`, `strikeLine` and the drawn beam `lineStrike`, `soldiersOnLine`, `fanOffset`, `launchShot`), shared by the ace and the AI |

Checks:

- **Compile time:** registries keyed by a type union (weapon and unit weapon behaviors, movement models, projectile kinds, effects) fail to compile when an entry is missing. Aim strategies and unit painters are keyed by plain strings and are checked at boot and in tests only.
- **Boot time:** `findMissingSimImplementations` and `findMissingPainters` check every name used in the JSON.
- **Tests:** `tests/data.test.ts` runs the same checks against the real data.

Other structural rules:

- **One job per System.** State used by only one system lives in that system.
- **`Combat` applies hits.** What a hit does is the damage rule list; what a death does is split into the wreck (`src/sim/deaths.ts`) and scoring.
- **Team-agnostic attacks.** The ace's weapon code uses `P.team`, so the same attack code serves both sides.
- **Small interfaces:** `System`, `MoveInput`, `CommandSink`, `WorldLayer`, `ScreenLayer`, `JoystickView`, `LoadoutStore`, `CareerStore`, `SettingsStore`, `Random`, `TimeStepper`.
- **Impact.** Sim code calls `kick(world, def)` (`src/sim/impact.ts`) for a big moment; `CanvasRenderer` applies the shake to the world transform and `ImpactFlashLayer` draws the flash. Screen layers get a `ScreenFrame` (world, view, size, the flash strength, and the options' preview flash). `CanvasRenderer.setFeel` takes the player's shake and flash strength; the reduced-motion setting scales both.
- **Settings and keys.** `src/game/settings.ts` holds the settings (shake, flash, HUD size, language, key bindings), their defaults, `sanitizeSettings` and `rebind`; `SettingsStore` keeps them in the browser. `App.applySettings` hands them to the renderer, sets the `--hud-scale` CSS variable and builds a `KeyMap` (`src/input/keymap.ts`): key → action lookups and key labels. The key map and key lists are rebuilt only when the bindings or the language change. `KeyboardInput` and the HUD read keys and labels from it; the hangar's key strip and the pause card list the same `controlGroups` (`src/ui/controls.ts`). Hardpoint actions are `slot:1`… (`slotAction`, `slotIndex`). `OptionsView` edits the settings; while it is open the input mode is `options` and the keyboard leaves keys to it.
- **Input modes.** `CommandSink.inputMode()` is `menu`, `options`, `launch`, `playing`, `paused` or `ended`. In `menu` Enter and Space call `confirm()` (launch); in `launch` any key calls `confirm()` (skip the launch sequence); in `ended` Esc calls `back()` and any other key `confirm()` (show the result, then sortie again).
- **Languages.** `src/i18n` holds one flat string table per language (`locales/en.json`, `ja.json`, `zh.json`, `ko.json`). `t(key, params)` looks a key up in the current language, then English, then returns the key; keys matching `ENGLISH_ONLY` (`launch.*`, the launch sequence) are always English and appear only in `en.json`; `{name}` placeholders take numbers, strings or nested messages. Player-facing text outside the sim always goes through `t()`.
  - **Sim text.** The sim stays language-free: banners and callouts carry a `Message` (`msg(key, params)`, `src/sim/messages.ts`), and the UI and painters render it with `tm()`. A message may carry a `fallback`, used when no table has the key (a class's `killBanner` from the data).
  - **Data text.** Text in the data files is English. `dataText` (`src/i18n/data.ts`) returns it in the current language from keys built by `textKeys` (`src/data/textKeys.ts`), such as `weapon.<id>.desc`; `dataStrings(catalog)` lists every such key. The sim uses the same builders for messages made of data text (a class's kill banner). Proper nouns (weapon, unit class, unit weapon and preset names) have no keys and show in English in every language; translations also keep Full Arms and semi-ace in English.
  - **Page text.** Static text in `index.html` carries `data-i18n` (text), `data-i18n-html` (markup) or `data-i18n-aria` (label) attributes; `applyStaticText()` fills them and sets `<html lang>`.
  - **Switching.** The language comes from the settings, or from the browser's languages when none is set (`detectLocale`). `LanguagePicker`, at the top right of the hangar, sets it. `App.applySettings` switches it, refills the page text, re-renders the hangar and the HUD, and re-reads the canvas palette (`CanvasRenderer.setPalette`, `Minimap.setPalette`) so canvas fonts follow.
  - **Fonts.** Latin comes from the bundled M PLUS 1 Code subsets (`src/fonts/`). CJK text comes from `--font-cjk`, ordered by `<html lang>` (`:root:lang()` in `style.css`): M PLUS 1 Code (Japanese), Noto Sans SC (Chinese), Nanum Gothic Coding (Korean), each split into unicode-range slices that load only for characters on screen.
  - **Checks.** `tests/i18n.test.ts` fails when a language lacks a key, a translation changes a placeholder or tag, or the code or page uses a key with no English string.
- **Launch sequence.** `App.launch` builds the battle paused, with the camera zoomed in by `player.launch.zoom`, and plays `LaunchView` (a DOM overlay animated in CSS). At its LAUNCH beat the battle unpauses and `launchAce` (`src/sim/launch.ts`) sets the ace moving east at `player.launch.speed` × its top speed, with afterimages and the `launch` impact; the camera eases back to the chosen zoom. When the overlay closes the HUD appears. A skip jumps to the LAUNCH beat and fades the overlay out.
- **Defeat tips.** `src/game/tips.ts` is an ordered list of rules (`when`, `text`); the result card of a lost sortie shows the first that applies. A new tip is a new rule.
- **Dependency inversion.** The sim depends on `Random`, `MoveInput` and `GameEvents`, not on `Math.random`, the keyboard or the DOM. `App` is the only composition root.
- **Colors.** The sim assigns a semantic `Tone`; the renderer maps it to CSS tokens via `readPalette()`.

## Recipes

### A new weapon that reuses a behavior

Add an entry to `public/data/weapons.json` with an existing `behavior` (`bullet`, `beam`, `rail`, `sniper`, `missile`, `shotgun`, `mortar`, `saber`). No code. The optional modifiers `fireWhileDashing`, `movingFireInterval` and `fullArmsFireInterval` work with any behavior (PlayerWeaponSystem applies them). The hangar lists weapons by `damageType`, in data order.

### A new weapon behavior

1. Add its def interface to the `WeaponDef` union in `src/data/types.ts` (`behavior: 'flamer'` plus its fields).
2. Write `src/sim/weapons/behaviors/flamer.ts` implementing `WeaponBehavior<FlamerWeapon>`. It creates shots or damage and returns the rounds used. Use `src/sim/attacks.ts` where possible. Optional members:
   - `targetsWanted`: needs more than one ranked target.
   - `burst`: Full Arms spray (use `burstAngle`; `burstArc` limits it to the front).
   - `roundsPerShot`: one shot launches several rounds.
   Ammo, cooldown and reload are handled by the caller.
3. Add a stat line in `DAMAGE_TEXT` (`src/ui/HangarView.ts`). TypeScript requires it.
4. Register it in `src/sim/weapons/registry.ts`. TypeScript requires it.
5. Add the weapon to `weapons.json` and a test to `tests/weapons.test.ts`.

### A new AI unit weapon

Add it to `public/data/unitWeapons.json` with an existing `behavior` (`shot`, `missile`, `lance`, `saber`) and point a class's `weapon` at it. No code.

For a new behavior:

1. Add its def to the `UnitWeaponDef` union in `src/data/types.ts`.
2. Implement `UnitWeaponBehavior` in `src/sim/ai/weapons/behaviors/`.
3. Register it in `src/sim/ai/weapons/registry.ts`.

A unit can be thrown with `knockBack` (`src/sim/ai/knockback.ts`), a `UnitAction` that replaces its current one. `UnitActionSystem` keeps an action that a finishing one started (a lunge whose slash clashes ends in a knockback). Saber-meets-saber rules live in `src/sim/clash.ts`; a `UnitAction` with `blade: true` is a saber swing.

The AI handles targeting, range and cooldown; an optional `reach` lets `fire` be called from beyond the weapon's `range` (the saber's dash strike). `fire` may return `false` to hold fire; the AI then retries after `ai.aceCharges.retry` (the lance and the dash strike do this when they have no turn at the ace, `src/sim/ai/aceCharges.ts`). A weapon that takes time sets `unit.action` to a `UnitAction` (see `LanceCharge`, and the saber's `DashWindup` and `Glide`): `step` runs each frame until it returns true, `holdsAI` says whether the AI waits, and an optional `sightLine` is drawn by `SightLineLayer`. A finishing action may hand over to the next (a dash strike's wind-up becomes a lunge, a lunge a hop back). Actions that move the unit use `moveUnit` (`src/sim/ai/unitMotion.ts`), which keeps it inside the field. A stun or death cancels the action.

### A new damage modifier

Write a `DamageRule` in `src/sim/damageRules.ts` (return the new amount, or null to block the hit) and add it to the relevant kinds in `DAMAGE_RULES`. Lists run top to bottom.

### A new aim mode

Add an `AimStrategy` to `AIM_STRATEGIES` in `src/sim/targeting/aimStrategies.ts` (lower score is better), then an entry in `aimModes.json` with its `strategy` and a key.

### A new unit class

Add it to `units.json` with a `weapon` from `unitWeapons.json` and an `armor` from `damage.json`, and give it a share in `armies.json`. Validation rejects a class with `semiAce` in the allied army (`allyMix`, `minimums`, `fillerClass`). For a new look, add a `UnitPainter` under a new shape name in `src/render/painters/unitPainters.ts` and a `.g-<shape>` legend glyph in `src/style.css`.

### A new damage type or armor

Add it to `public/data/damage.json`. A type needs an entry in every armor's `vs` table (validation enforces this), a color token `--<id>` and a `.dt-<id>` class in `src/style.css`. An armor is a new `vs` table. The `armor` damage rule applies `Catalog.armorMultiplier` to every typed hit.

### A new projectile kind or visual effect

Add it to the `Projectile` or `Effect` union in `src/sim/entities.ts`, then register a `ProjectileMotion` (`src/sim/projectiles/motions.ts`) and a look (`shotPainters.ts`: a list of passes, each with a color, optional width and a `trace`) or an effect painter (`effectPainters.ts`).

### A new ace movement model

Add its def to the `MovementDef` union in `src/data/types.ts`, implement `MovementModel` in `src/sim/movement/` (`steer` sets velocity; optional `afterDash`), register it in `src/sim/movement/registry.ts`, and select it in `battle.json` → `player.movement.model`. `PlayerMovementSystem` handles position, dash, lunge and walls for every model.

### A new mechanic

Write a `System` and add it to `battlePipeline()`. Player input: add a method to `PlayerCommands` and `CommandSink`. UI notification: add an event to `GameEvents`.

### A new input device

Implement `MoveInput` for movement and call `CommandSink` methods for buttons. Add it to `combineMoveInputs` in `App`. A new rebindable key action is an entry in `actionList` and `defaultKeys` (`src/game/settings.ts`) and a case in `KeyboardInput`.

## Balance test

`tests/balance/weaponBench.ts` flies the ace (bot pilot, one weapon) against an enemy formation drawn from the enemy mix. The ace takes a negligible fraction of damage, so the bench also measures how much fire each weapon draws. Both rates are measured until 90% of the formation's HP is destroyed, so a straggler the bot fails to chase down does not skew them. `tests/balance.test.ts` runs it on every `npm test` and fails if:

- a ranged weapon's damage output leaves 0.7×–1.5× of the median weapon, or the Beam Saber's leaves 0.7×–2.5×;
- the Beam Saber draws less than 1.2× the fire of the most exposed ranged weapon;
- any ranged weapon draws no fire while kiting;
- the median ranged weapon draws 150 or less incoming damage per minute.

## Performance

A battle runs about 400 units and a few hundred projectiles.

- **Spatial grid.** `SpatialGrid` is rebuilt every step without allocating. It answers box, radius, nearest-hostile (ring by ring) and segment queries. `forEachNearSegment` walks only the cells along a line, so line weapons check a few dozen units.
- **Closed-form math.** AI lead aim solves the intercept time as a quadratic (`src/sim/ai/aim.ts`).
- **Culling.** `UnitLayer` and `ShotLayer` skip anything outside the view plus a margin.
- **Per-shot drawing.** Shots are drawn individually; the canvas batches draw calls itself.
- **Low-cost visuals.** Streaks come from velocity (no trail history), lance discharges are a fading `line`, sight lines are plain lines, mortar arcs are two discs, and missile weaving is one sine per missile per step.

## Determinism

All simulation randomness goes through `world.random` (`SeededRandom`). Property order in `UnitFactory` fixes the order of random draws. `?seed=N` fixes a sortie's seed. With the same seed and the same `dt` sequence a battle replays exactly (`tests/simulation.test.ts`).

## Related

- [mechanics.md](mechanics.md): the rules these systems implement
- [data.md](data.md): data files and fields
- [AGENTS.md](../AGENTS.md): commands, rules, testing, debugging
