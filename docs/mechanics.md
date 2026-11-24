# Mechanics

The rules the simulation runs. Values quoted are the current data; [reference.md](reference.md) has every value and [data.md](data.md) names the field for each. Code locations are in [architecture.md](architecture.md).

## Simulation step

The battle is a headless simulation (`src/sim`), stepped once per animation frame with `dt` capped at 0.05 s. Each step runs 20 systems in a fixed order: grid rebuild, separation, army centers, auras, shields, ace statuses, ace movement, ace weapons, stalking, unit AI, unit actions, decoys, projectiles, effects, clock, reinforcements, alerts, victory, cleanup, camera ([architecture.md](architecture.md#battle-pipeline)). Rendering and the HUD read the world and never change it.

## Damage

A **hit** carries its source (`player` or `army`), weapon id, damage type, and whether a semi-ace fired it.

When a hit lands, the target runs its kind's **damage rules** in order. Each rule scales the amount or cancels the hit.

| Target | Rules, in order |
| --- | --- |
| **The ace** | × `aceDamageTaken` (0.5) × running statuses' `damageTaken` (Overboost: 0.7) → record the hit (stats; resets the regeneration delay) |
| **An AI unit** | Shield (may cancel) → army softening (`army` hits × `unitVsUnit`, 0.15) → ace vulnerability (× `aceHitMul` if the hit is the ace's or a semi-ace's) → armor (× the armor's value for the damage type) |
| **A decoy** | Army softening |

The result is subtracted from HP. At 0 HP the unit dies.

The ace cannot be hit while it has invulnerability frames, which start with a dash (0.28 s) or a Beam Saber lunge (0.12 s).

### Examples

| Hit | Calculation | Result |
| --- | --- | --- |
| Ace's Assault Rifle (28 Kinetic) on an enemy Trooper (75 HP) | 28 × 1.5 (normal ALTER) × 1 (standard) | 42 (2 hits) |
| Ace's Assault Rifle on a Bulwark (320 HP) | 28 × 0.5 (heavy plate) | 14 (23 hits), RESIST |
| Ace's Beam Rifle (70 Beam) on a Bulwark | 70 × 1.5 | 105 (4 hits), CRITICAL |
| Enemy Trooper's rifle (5 Kinetic) on an allied Trooper | 5 × 0.15 (army) | 0.75 |
| Enemy Duelist's saber (40 Beam) on an allied Trooper | 40 × 0.15 × 1.5 (semi-ace) | 9 |
| Enemy Trooper's rifle on the ace | 5 × 0.5 | 2.5 |
| The same, during Overboost | 5 × 0.5 × 0.7 | 1.75 |

### Splash

A blast hits every hostile unit whose edge is inside its radius. Damage falls off linearly from full at the center to half at the edge. Each unit reached runs its damage rules with the damage type of the weapon that caused the blast.

### Markers

When a unit's defenses change one of the **ace's** hits, the hit shows a marker: CRITICAL when the armor multiplier is above 1, RESIST when it is below 1, SHIELD when a shield blocks it. Labels are limited to one per unit every 0.45 s. Army hits show no markers.

### Death and scoring

A destroyed unit leaves debris, plus a blast for large units. Then:

- **Enemy death:** the enemy count drops. If the killing hit came from an ace weapon (direct or splash), it counts as the ace's kill and in that weapon's tally. Classes with `killBanner` (Commander, semi-aces) show a banner.
- **Ally death:** the ally count drops.
- **Ace death:** the sortie ends in defeat.

## Shields

A class with `shield` (the semi-aces: `duration` 1.5 s, `cooldown` 10 s):

1. **Ready.** The next hit raises the shield and is blocked.
2. **Up** for `duration`. Every hit is blocked. A bubble is drawn, flickering before it drops.
3. **Recharging** for `cooldown`, counted from when it rose. Hits land normally.

A stunned unit's shield cannot rise, and a raised shield drops.

## Stuns and unit actions

An EMP stuns enemy units within its radius:

- **Movement:** stops.
- **Current action:** canceled. A Sentinel loses its lance charge; a Duelist's lunge ends without a slash.
- **Shield:** dropped, and cannot rise.

The EMP also deletes every enemy projectile within its radius.

A **unit action** is something a unit does over time, one per unit:

- **Lance charge (Sentinel):** the sight line tracks for 1.2 s, freezes for the last 0.35 s, then strikes the whole line.
- **Saber lunge (Duelist):** a dash of up to 0.22 s, then an arc slash.

A unit running an action does not steer or fire anything else.

## The ace

### Movement

Model `thruster` (`player.movement.model`):

- **Thrust:** input accelerates the ace; standstill to top speed takes 0.8 s.
- **Drag:** with no input the ace coasts, losing speed at 0.6/s (it halves about every 1.2 s).
- **Lateral drag:** sideways velocity fades at 0.4/s while thrusting.
- **Top speed:** the frame's `speed`, × Overboost's `speedMul` while it runs. Acceleration scales with top speed.
- **Walls:** velocity into the world edge is removed.

Model `direct` is also available: velocity eases toward input × top speed almost at once ([data.md](data.md#ace-movement-battlejson--playermovement)).

### Dash

Shift moves the ace 240 units in 0.16 s.

- **Direction:** the steering direction, or the facing direction with no input.
- **Invulnerability:** 0.28 s.
- **Exit speed:** full top speed in the dash direction (`dashCarry` 1).
- **Recharge:** the frame's `dashCd` (1.4–3.2 s).
- **Weapons:** do not fire during a dash.

### Regeneration

After `regenDelay` (4 s) without damage, the ace regains `regenPerSecond` (3%) of max HP per second. Any hit resets the delay.

### Statuses

Timed effects on the ace. A status can multiply stats, heal per second, draw a ring around the ace, and make every weapon fire. Using the same tool again refreshes its status instead of stacking it. Multipliers from different statuses multiply together.

| Status | Source | Effect |
| --- | --- | --- |
| Overboost | Overboost tool | Speed ×1.7, time between shots ×0.6, damage taken ×0.7, for 4 s |
| Repair | Repair Nanites | Heals 35% of max HP over 3 s |
| Super release | Space | Every weapon hardpoint fires, for 3 s |

## Firing

Each step, for the ace:

1. **Background reloads.** Every hardpoint's timers run down, including inactive weapons.
2. **Reticle.** Every 0.12 s the aim mode picks the best target within the active weapon's range. The ace faces its target, or its movement direction when it has none.
3. **Fire.** The active weapon fires if it has ammo, is not reloading, is off cooldown, and the ace is not dashing or lunging. During super release every weapon hardpoint does this, each with its own target in its own range.
4. **Cooldown.** After a shot, the next waits `interval` × the frame's `rateMul` × statuses' `fireInterval`. An empty magazine starts a reload of `reload` × the frame's `reloadMul`.

### Aim modes

Each mode scores every enemy in range; the lowest score wins. Distance breaks ties.

| Mode | Primary key |
| --- | --- |
| Closest / Furthest | Distance (shortest / longest) |
| Lowest HP | HP |
| Strongest | Class rank, then HP |
| Densest pack | Number of enemies in the surrounding 3 × 3 grid cells |
| Attacking me | Whether the enemy is targeting the ace |

### Missiles

- **Targets:** a salvo asks the aim mode for as many ranked targets as it has missiles and assigns them in order. With fewer targets than missiles, targets repeat.
- **Launch:** missiles leave at `launchAngle` to their target (π: straight back), spread by `fanAngle`, fly straight for `homingDelay`, then steer at up to `turnRate`.
- **Retargeting:** a missile whose target dies picks a random enemy nearby.

### The super release burst

Each weapon hardpoint launches

```
count = max(1, round(openingBurst × roundsPerShot ÷ (interval × frame rateMul)))
```

rounds at once. `openingBurst` is 2.5 s. `roundsPerShot` is the pellet count for the Scatter Cannon, the salvo size for the Missile Pod, and 1 otherwise. Each round goes in a random direction within the weapon's `burstArc` around the facing (360° by default, 60° for the Beam Rifle and Railgun), at a randomly varied speed. The burst ignores ammo and needs no target. Burst missiles take one enemy in range each before any target repeats. The super release status then runs for 3 s. The 30 s recharge starts when Space is pressed.

## AI

Target priority, movement, firing and leashes: [units.md](units.md#ai-behavior). Stalking and packs: [units.md](units.md#stalking-and-packs).

## Battle flow

- **Deployment:** [units.md](units.md#deployment-and-reinforcements).
- **Reinforcements:** while reserves remain, a battalion enters from the east edge at a random height when the reserve timer (25 s) expires or the enemies on the field drop below 150. The timer restarts with each battalion.
- **Alerts:** one-time banners when half the allies are down, when all are down, when the final reserves deploy, and when the ace drops below 25% HP (re-armed above 50%).
- **Victory:** no enemy on the field and none in reserve.
- **Defeat:** the ace is destroyed. Losing all allies is not a defeat.
- **Rank:** on victory, share = ace kills ÷ enemy total. The first threshold met gives the letter: S 60%, A 45%, B 30%, otherwise C.

## Determinism

- **Seeded randomness.** All simulation randomness (deployment jitter, army order, retarget timers, spread, burst directions) comes from one seeded generator on the world. `?seed=N` in the URL fixes the seed; the console logs each battle's seed.
- **Replays.** The same seed with the same sequence of `dt` values reproduces a battle exactly.
- **Live play.** In the browser the step follows the frame rate, so a live battle also depends on frame timing.

## Related

- [reference.md](reference.md#battle-rules): rule values
- [data.md](data.md): files and fields
- [architecture.md](architecture.md): code structure
- [glossary.md](glossary.md): terms
