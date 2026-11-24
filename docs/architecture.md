# Architecture

How the code is organized and how to extend it. The rules it implements are in [mechanics.md](mechanics.md); the data it loads is in [data.md](data.md); contributor rules and commands are in [AGENTS.md](../AGENTS.md).

## Layers

```
public/data/*.json      tuning data (no code)
        │
src/data         types, validation, Catalog (lookup by id)
        │
src/sim          headless simulation: World state + Systems + strategies      ← no DOM, no canvas
        │  events (banner, battleEnded, slotDenied, demoExhausted)
        ▼
src/render       canvas layers and painters (reads World, never changes it)
src/ui           DOM views: hangar, HUD, result, pause, banner
src/input        keyboard, touch joystick, wheel → CommandSink / MoveInput
src/game         loadout model and storage, sortie rating (no DOM)
src/app          App: composition root and screen flow; GameLoop
src/main.ts      boot: load and validate data, start the App, data hot reload (dev)
```

Dependencies point downward only. `src/sim` does not import `render`, `ui`, `input` or `app`, so a whole battle runs in Vitest (`tests/simulation.test.ts`).

## One frame

`GameLoop` (requestAnimationFrame) → `TimeStepper.advance` → `Simulation.step(world, dt)` runs the systems in pipeline order → `CanvasRenderer.render(world)` runs the layers → `HudView.update(world)`.

`VariableStep` (one step per frame, `dt` capped at 0.05 s) implements `TimeStepper`.

## Battle pipeline

`battlePipeline()` in `src/sim/pipelines.ts`:

| # | System | Job |
| -: | --- | --- |
| 1 | `GridSystem` | Rebuild the spatial grid |
| 2 | `SeparationSystem` | Push overlapping units apart |
| 3 | `CentroidSystem` | Average position of each army |
| 4 | `AuraSystem` | Commander fire-rate aura |
| 5 | `ShieldSystem` | Shield timers (the `shield` damage rule raises a shield on a hit) |
| 6 | `PlayerStatusSystem` | Ace timers, statuses, regeneration |
| 7 | `PlayerMovementSystem` | Steering, dash, saber lunge, walls |
| 8 | `PlayerWeaponSystem` | Reloads, reticle, automatic fire, super release |
| 9 | `StalkSystem` | Enemy semi-aces that find the ace start stalking and rally packs; packs disband when the leader dies |
| 10 | `SoldierAISystem` | Target selection, approach / kite / strafe, leashes, firing |
| 11 | `UnitActionSystem` | Step unit actions (lance charges, saber lunges) |
| 12 | `DecoySystem` | Decoy lifetime |
| 13 | `ProjectileSystem` | Move shots, resolve hits and splash |
| 14 | `EffectSystem` | Age visual effects |
| 15 | `BattleClockSystem` | Battle timer |
| 16 | `ReinforcementSystem` | Enemy battalions from the east edge |
| 17 | `AlertSystem` | One-time banners |
| 18 | `VictorySystem` | Victory when no enemies remain |
| 19 | `CleanupSystem` | Remove dead units |
| 20 | `FollowCameraSystem` | Camera follows the ace |

`demoPipeline()` (hangar skirmish) runs the same systems except the ace systems (statuses, movement, weapons), `StalkSystem`, `BattleClockSystem`, `ReinforcementSystem`, `AlertSystem`, `VictorySystem` and `FollowCameraSystem`, and adds `DemoDirectorSystem` and `DemoCameraSystem`.

## Extension points

Every variant is a **strategy in a typed registry**, selected by name from the data. Adding a variant means adding an implementation and a registry entry; the systems that use it do not change.

| Variant | Data field | Registry / list |
| --- | --- | --- |
| Ace weapon behavior | `weapons.json` → `behavior` | `src/sim/weapons/registry.ts` |
| AI unit weapon behavior | `unitWeapons.json` → `behavior` | `src/sim/ai/weapons/registry.ts` |
| Tool effect | `tools.json` → `effect` | `src/sim/tools/registry.ts` |
| Aim mode | `aimModes.json` → `strategy` | `AIM_STRATEGIES` in `src/sim/targeting/aimStrategies.ts` |
| Ace movement model | `battle.json` → `player.movement.model` | `src/sim/movement/registry.ts` |
| Unit look | `units.json` → `shape` | `src/render/painters/unitPainters.ts` |
| Projectile motion / look | `Projectile['kind']` | `src/sim/projectiles/motions.ts`, `src/render/painters/shotPainters.ts` |
| Visual effect | `Effect['type']` | `src/render/painters/effectPainters.ts` |
| Damage modifier | – | `DAMAGE_RULES` in `src/sim/damageRules.ts`, per unit kind |
| Timed unit behavior | – | `UnitAction` in `unit.action`, run by `UnitActionSystem` |
| Ace buff | – | `Status` in `Player.statuses` (`src/sim/statuses.ts`); read with `statMul(P, stat)` |
| Attack shape | – | `src/sim/attacks.ts` (`arcSlash`, `lineStrike`, `fanOffset`, `launchShot`), shared by the ace and the AI |

Checks:

- **Compile time:** registries keyed by a type union (weapon, unit weapon and tool behaviors, movement models, projectile kinds, effects) fail to compile when an entry is missing. Aim strategies and unit painters are keyed by plain strings and are checked at boot and in tests only.
- **Boot time:** `findMissingSimImplementations` and `findMissingPainters` check every name used in the JSON.
- **Tests:** `tests/data.test.ts` runs the same checks against the real data.

Other structural rules:

- **One job per System.** State used by only one system lives in that system.
- **`Combat` applies hits.** What a hit does is the damage rule list; what a death does is split into the wreck (`src/sim/deaths.ts`) and scoring.
- **Team-agnostic attacks.** The ace's weapon code uses `P.team`, so the same attack code serves both sides.
- **Small interfaces:** `System`, `MoveInput`, `CommandSink`, `WorldLayer`, `ScreenLayer`, `JoystickView`, `LoadoutStore`, `Random`, `TimeStepper`.
- **Dependency inversion.** The sim depends on `Random`, `MoveInput` and `GameEvents`, not on `Math.random`, the keyboard or the DOM. `App` is the only composition root.
- **Colors.** The sim assigns a semantic `Tone`; the renderer maps it to CSS tokens via `readPalette()`.

## Recipes

### A new weapon that reuses a behavior

Add an entry to `public/data/weapons.json` with an existing `behavior` (`bullet`, `scatter`, `beam`, `rail`, `missile`, `rocket`, `mortar`, `saber`). No code.

### A new weapon behavior

1. Add its def interface to the `WeaponDef` union in `src/data/types.ts` (`behavior: 'flamer'` plus its fields).
2. Write `src/sim/weapons/behaviors/flamer.ts` implementing `WeaponBehavior<FlamerWeapon>`. It creates shots or damage and returns the rounds used. Use `src/sim/attacks.ts` where possible. Optional members:
   - `targetsWanted`: needs more than one ranked target.
   - `burst`: super release spray (use `burstAngle`; `burstArc` limits it to the front).
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

The AI handles targeting, range and cooldown. A weapon that takes time sets `unit.action` to a `UnitAction` (see `LanceCharge`, `SaberLunge`): `step` runs each frame until it returns true, `holdsAI` says whether the AI waits, and an optional `sightLine` is drawn by `SightLineLayer`. A stun or death cancels the action.

### A new tool

1. Add a `ToolDef` variant in `src/data/types.ts`.
2. Implement `ToolEffect` in `src/sim/tools/effects/<name>.ts`.
3. Register it in `src/sim/tools/registry.ts` and add it to `tools.json`.

Recharge is handled by `useTool`. A buff is a `Status` added with `addStatus`: stat multipliers (`speed`, `fireInterval`, `damageTaken`), healing per second, and an optional ring. Movement, firing, damage, the ace's look and the HUD chips read statuses without new fields.

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

Implement `MoveInput` for movement and call `CommandSink` methods for buttons. Add it to `combineMoveInputs` in `App`.

## Balance test

`tests/balance/weaponBench.ts` flies the ace (bot pilot, one weapon) against an enemy formation drawn from the enemy mix. The ace takes a negligible fraction of damage, so the bench also measures how much fire each weapon draws. `tests/balance.test.ts` runs it on every `npm test` and fails if:

- a weapon's damage output leaves 0.7×–1.5× of the median weapon;
- the Beam Saber draws less than 1.75× the fire of the most exposed ranged weapon;
- any ranged weapon draws no fire while kiting;
- the median ranged weapon draws 150 or less incoming damage per minute.

## Performance

A battle runs about 400 units and a few hundred projectiles.

- **Spatial grid.** `SpatialGrid` is rebuilt every step without allocating. It answers box, radius, nearest-hostile (ring by ring) and segment queries. `forEachNearSegment` walks only the cells along a line, so line weapons check a few dozen units.
- **Closed-form math.** AI lead aim solves the intercept time as a quadratic (`src/sim/ai/aim.ts`).
- **Culling.** `UnitLayer` and `ShotLayer` skip anything outside the view plus a margin.
- **Per-shot drawing.** Shots are drawn individually; the canvas batches draw calls itself.
- **Low-cost visuals.** Streaks come from velocity (no trail history), lance discharges reuse the fading `rail` line, sight lines are plain lines, mortar arcs are two discs, and missile weaving is one sine per missile per step.

## Determinism

All simulation randomness goes through `world.random` (`SeededRandom`). Property order in `UnitFactory` fixes the order of random draws. `?seed=N` fixes a sortie's seed. With the same seed and the same `dt` sequence a battle replays exactly (`tests/simulation.test.ts`).

## Related

- [mechanics.md](mechanics.md): the rules these systems implement
- [data.md](data.md): data files and fields
- [AGENTS.md](../AGENTS.md): commands, rules, testing, debugging
