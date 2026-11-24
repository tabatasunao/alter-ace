# Data files

Every gameplay number lives in `public/data/*.json`. This page describes the files and their key fields. [reference.md](reference.md) lists every current value; [mechanics.md](mechanics.md) describes the rules they drive.

- **Types:** [`src/data/types.ts`](../src/data/types.ts).
- **Validation:** [`src/data/validate.ts`](../src/data/validate.ts): ids exist, shares fit, cross-file rules, the default loadout is legal. At boot the game also checks that every `behavior`, `effect`, `strategy` and `shape` named in the data has an implementation. Invalid data stops the game with a list of every problem. `npm test` runs the same checks.
- **Loading:** the game fetches the files at runtime. A request that fails with a network error or a server error (5xx, 408, 429) is retried up to three times, after 0.5 s, 1 s and 2 s (`src/data/load.ts`). A missing file or invalid JSON fails at once.
  - **Dev server** (`npm run dev`): saving a file reloads the data without a page reload. It applies immediately in the hangar and from the next sortie in battle.
  - **Build** (`dist/`): edit `dist/data/*.json` and refresh.
- **After a change:** run `npm run docs` to regenerate [reference.md](reference.md), then `npm test`.

| File | Contents |
| --- | --- |
| `frames.json` | The 3 frames: speed, HP, reload / fire-rate / tool multipliers, dash recharge |
| `damage.json` | Damage types (Kinetic, Beam, Blast) and armor tables |
| `weapons.json` | The ace's 9 weapons. `behavior` selects the firing code, `damageType` the damage type; other fields are stats |
| `tools.json` | The 4 tools. `effect` selects the code; other fields are parameters |
| `aimModes.json` | Aim modes in Q/E order, each with `strategy` and number `key`; reticle refresh interval |
| `unitWeapons.json` | The 13 AI unit weapons. `behavior` selects the firing code (`shot`, `missile`, `lance`, `saber`) |
| `units.json` | The 13 AI unit classes: stats, `weapon`, `shape`, `armor`, AI fields (`kiteDistance`, `huntsAce`, `nearAce`, `rally`), `aura`, `shield`, `semiAce`, `aceHitMul`, `killBanner` |
| `armies.json` | Army mixes, minimums, filler class, formation, deployment, reinforcements, hangar skirmish |
| `loadout.json` | Hardpoint count, enemy-count slider range, default loadout |
| `battle.json` | World size, limits, balance values, AI tuning, ace movement, dash, regeneration, super release, camera, alerts, rank thresholds |

## Conventions

- Distances are world units (1 unit = 1 px at zoom 1). The world is 6000 × 3400.
- Times are seconds, speeds units per second, angles radians (except `burstArc`, in degrees).
- A weapon `mag` of `null` means no magazine (the Beam Saber).

## Damage types and armor (`damage.json`)

Every weapon (ace and AI) has a `damageType`; every unit class has an `armor`. A hit on a unit is multiplied by the armor's `vs` value for the hit's type. The ace has no armor class. Splash uses the type of the weapon that caused it.

| Armor | Kinetic | Beam | Blast | Worn by |
| --- | --: | --: | --: | --- |
| Standard | 1 | 1 | 1 | Trooper, Beam Trooper, Striker, Lancer, Sentinel, Hornet, Marksman, Commander |
| Heavy plate | 0.5 | 1.5 | 1 | Bulwark, Circus |
| Beam coating | 1 | 0.5 | 1.5 | Prism, Duelist |
| Reactive armor | 1.5 | 1 | 0.5 | Breacher |

Each type needs an entry in every armor's `vs` table, a CSS color token `--<id>` and a `.dt-<id>` class in `src/style.css`.

## Unit weapons (`unitWeapons.json`)

Each unit class carries one weapon (`units.json` → `weapon`).

| Class | Weapon | Type | Behavior | Range | Notes |
| --- | --- | --- | --- | --: | --- |
| Trooper | Assault rifle | Kinetic | `shot` | 320 | |
| Beam Trooper | Beam rifle | Beam | `shot` | 380 | |
| Striker | Beam pistol | Beam | `shot` | 270 | |
| Bulwark | Heavy cannon | Kinetic | `shot` | 300 | |
| Lancer | Artillery | Blast | `shot` | 600 | Splash |
| Sentinel | Beam lance | Beam | `lance` | 840 | Charged |
| Hornet | Missile rack | Blast | `missile` | 720 | 2 homing missiles |
| Prism | Beam cannon | Beam | `shot` | 460 | |
| Breacher | Scattergun | Kinetic | `shot` | 200 | 4 pellets |
| Marksman | Long beam rifle | Beam | `shot` | 760 | Pierces 2 |
| Circus | Micro-missile swarm | Blast | `missile` | 650 | 16 weaving missiles, launched backwards |
| Duelist | Beam saber | Beam | `saber` | 136 | Lunge, then slash |
| Commander | Beam repeater | Beam | `shot` | 460 | |

Common fields: `dmg` (per hit, before `unitVsUnit` or `aceDamageTaken`), `range` (fires inside it; the unit approaches to about 82% of it), `interval` (seconds between shots), `damageType`.

| Behavior | Fields |
| --- | --- |
| `shot` | `projectile` (`bullet`, `beam` or `shell`: look and hit radius `radius`), `speed`, `spread` (± radians), `lead` (0 = aim at the target, 1 = full intercept), optional `pellets`, `pierce` (extra units passed through), `splash`, `splashDmg` |
| `missile` | `salvo` (missiles per shot), `launchSpeed`, `acceleration`, `speed`, `turnRate` (rad/s), `life`, `splash`, `splashDmg`. Optional `weave` (`amplitude` in radians, `frequency` in swings per second, random phase per missile), `launchAngle` (radians from the target; π = straight back), `homingDelay` (seconds before homing), `fanAngle`, `radius` (hit radius), `retargetRadius`. The ace's Missile Pod uses the same launch fields in `weapons.json` |
| `lance` | `charge` (seconds the sight line tracks), `lock` (final seconds the line is frozen), `width` (units within this distance of the line are hit), `lead`. A stun cancels the charge |
| `saber` | `lungeSpeed`, `maxLunge` (seconds), `stopDistance`, `slash` (reach), `arcHalfAngle` (radians), `closeRange` (always hit within this). A stun ends the lunge without a slash |

## Unit classes (`units.json`)

| Field | Meaning |
| --- | --- |
| `hp`, `speed`, `size` | Hit points, top speed, body diameter (hits and separation use half of it) |
| `weapon` | Id in `unitWeapons.json` |
| `armor` | Id in `damage.json` |
| `shape` | Look; must have a painter |
| `rank` | Priority for the Strongest aim mode |
| `kiteDistance` | Backs away from targets closer than this |
| `huntsAce` | Always a hunter |
| `nearAce` | Leash distance to the ace while stalking (semi-aces) |
| `rally` | Pack rallied when stalking starts: `min`, `max`, `radius`, `follow` (leash to the leader) |
| `aura` | `radius`, `fireRateMul` for nearby units of the same army |
| `shield` | `duration`, `cooldown` (`cooldown` must exceed `duration`) |
| `semiAce` | Semi-ace class: its hits count as the ace's for `aceHitMul`; enemy army only |
| `aceHitMul` | Damage multiplier from the ace and semi-aces (normal ALTERs: 1.5) |
| `formationOffset` | How far ahead of its group's center the class deploys (negative: behind) |
| `killBanner` | Banner text when a unit of this class dies in the enemy army |
| `blurb` | Hangar legend text |

### Normal ALTERs

Trooper (filler class) and Beam Trooper (`armies.json`: 0.2 of the allies, 0.18 of the enemy). Standard armor and `"aceHitMul": 1.5`.

### Semi-aces

Marksman, Circus and Duelist (`"semiAce": true`, `nearAce` 400, `rally` 10–20 within 600, `follow` 220, `shield` 1.5 s / 10 s). They appear only in `enemyMix` (0.005 each). Validation rejects a semi-ace in `allyMix`, `minimums` or `fillerClass`, since those apply to the allied army.

## Armies (`armies.json`)

| Field | Meaning |
| --- | --- |
| `allyMix`, `enemyMix` | Class shares per army (sum ≤ 1) |
| `fillerClass` | Fills the remaining share |
| `minimums` | Minimum count per class, per army |
| `formation` | `spacing`, `jitter`, `columnsFactor`, `edgeMargin` |
| `battle.allies` | `count`, `groups`, `x`, `groupSpacing` |
| `battle.enemies` | `initial` (deployed at start), `groups`, `x`, `xJitter`, `groupSpacing` |
| `reinforcements` | `battalion` (size), `interval` (s), `fieldThreshold` (send early below this), `edgeOffset`, `yMargin` |
| `demo` | Hangar skirmish: `allies`, `enemies`, `groups`, positions |

Counts are rounded shares, raised to the minimums; only the order is random.

## Balance values (`battle.json` → `balance`)

| Field | Value | Effect |
| --- | --: | --- |
| `unitVsUnit` | 0.15 | Scales damage between AI units |
| `aceDamageTaken` | 0.5 | Scales damage to the ace |
| `aceAggro` | 0.35 | Chance an enemy unit without `huntsAce` is a hunter |
| `aceHuntRange` | 800 | Hunters target the ace inside this range; enemy semi-aces start stalking |

The Railgun's range (760) is below `aceHuntRange`. `tests/balance.test.ts` checks the weapon balance band on every `npm test` ([architecture.md](architecture.md#balance-test)).

## Ace movement (`battle.json` → `player.movement`)

`model` selects how input becomes velocity.

**`"thruster"`** (default): input is thrust.

| Field | Default | Effect |
| --- | --: | --- |
| `thrustTime` | 0.8 | Seconds of full thrust from standstill to top speed |
| `drag` | 0.6 | Slowdown with no input (1/s). 0.6 halves speed about every 1.2 s; 0 = no slowdown. Also removes excess speed when Overboost ends |
| `lateralDrag` | 0.4 | Decay of sideways velocity while thrusting (1/s) |
| `dashCarry` | 1 | Fraction of top speed kept in the dash direction when a dash ends |

**`"direct"`**: velocity eases toward input × top speed. One field: `response` (1/s).

```json
"movement": { "model": "direct", "response": 12 }
```

Top speed is the frame's `speed` (× Overboost's `speedMul`); acceleration scales with it.

## Super release (`battle.json` → `player.superRelease`)

| Field | Value | Effect |
| --- | --: | --- |
| `openingBurst` | 2.5 | Seconds' worth of each weapon's fire launched at once when triggered |
| `duration` | 3 | Seconds during which every weapon hardpoint fires |
| `cooldown` | 30 | Recharge, counted from activation. Ready at sortie start |

Each weapon behavior's `burst` defines its spray. `weapons.json` → `burstArc` (degrees, default 360) limits the spray to a front arc (60 for the Beam Rifle and Railgun). During the barrage tools do not fire. Super release is a `Status` with `allWeapons`.

## Related

- [reference.md](reference.md): every current value
- [mechanics.md](mechanics.md): the rules these values drive
- [architecture.md](architecture.md): where each file is read
