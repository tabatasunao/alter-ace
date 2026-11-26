# Mechanics

The rules the simulation runs. Values quoted are the current data; [reference.md](reference.md) has every value and [data.md](data.md) names the field for each. Code locations are in [architecture.md](architecture.md).

## Simulation step

The battle is a headless simulation (`src/sim`), stepped once per animation frame with `dt` capped at 0.05 s. Each step runs 24 systems in a fixed order: grid rebuild, separation, army centers, auras, heal pulses, shields, ace statuses, super release, ace movement, ace weapons, stalking, unit AI, unit actions, decoys, projectiles, effects, impact, clock, reinforcements, alerts, praise, victory, cleanup, camera ([architecture.md](architecture.md#battle-pipeline)). During hit-stop only effects, impact and camera run; during slow motion every system gets a scaled `dt` ([Impact](#impact)). Rendering and the HUD read the world and never change it.

## Damage

A **hit** carries its source (`player` or `army`), weapon id, damage type, and whether a semi-ace fired it.

When a hit lands, the target runs its kind's **damage rules** in order. Each rule scales the amount or cancels the hit.

| Target | Rules, in order |
| --- | --- |
| **The ace** | × `aceDamageTaken` (0.5) × running statuses' `damageTaken` (Overboost: 0.7; super release: 0.5) → record the hit (stats; resets the regeneration delay) → hit reaction (every hit, scaled by damage, full at 6% of max HP) → heavy-hit impact (a hit of 8% of max HP or more) |
| **An AI unit** | Shield (may cancel) → army softening (`army` hits × `unitVsUnit`, 0.15) → ace vulnerability (× `aceHitMul` if the hit is the ace's or a semi-ace's) → armor (× the armor's value for the damage type) → exposed (× `exposedMul`, 1.5, while a Plasma Mortar stun lasts) → stagger (an ace hit of 60 or more makes the unit judder; visual only) |
| **A decoy** | Army softening |

The result is subtracted from HP. At 0 HP the unit dies.

The ace's body is 22 across (`player.size`), so a shot hits it within 11 plus the shot's radius. The ace cannot be hit while it has invulnerability frames, which start with a dash (0.28 s), a Beam Saber lunge (0.12 s) or super release (0.6 s). Shots pass through it.

AI fire at the ace sharpens up close (close-quarters fire, `ai.closeAim`): within `range` (400) of the ace, a unit's lead rises toward `lead` (1, the full intercept; a weapon that leads more keeps its own), its spread narrows toward × `spread` (0.3) and its fire rate rises toward × `fireRate` (2), each linear in closeness (1 − distance ÷ range). Lances keep their own lead.

Charged attacks at the ace take turns (`ai.aceCharges`): at most `max` (2) units charge a lance at the ace at once. A new charge fires at least `gap` (0.6 s) after the latest one already scheduled; its tracking phase runs longer to make room. A unit without a turn holds fire and retries after `retry` (0.5 s). A holder that dies, is stunned or fires gives its turn back.

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

- **Enemy death:** the enemy count drops. If the killing hit came from an ace weapon (direct or splash), it counts as the ace's kill and in that weapon's tally, and charges the super release gauge. Classes with `killBanner` (Commander, semi-aces) show a banner; an ace kill of one is a big-kill impact.
- **Ally death:** the ally count drops.
- **Ace death:** an impact with slow motion; the sortie ends in defeat.

## Shields

A class with `shield` (the semi-aces: `duration` 1.5 s, `cooldown` 10 s):

1. **Ready.** The next hit raises the shield and is blocked.
2. **Up** for `duration`. Every hit is blocked. A bubble is drawn, flickering before it drops.
3. **Recharging** for `cooldown`, counted from when it rose. Hits land normally.

A stunned unit's shield cannot rise, and a raised shield drops.

## Heal pulses

A class with `heal` (the Healer: `interval` 10 s, `radius` 220, `amount` 0.15) pulses every `interval` seconds. Each unit of its army within `radius` (measured to the unit's edge) regains `amount` × its max HP, up to full. The ace is on the allied team, so allied Healers heal it too. First pulses are spread over one interval, so Healers do not pulse in step.

## Stuns and unit actions

An EMP stuns enemy units within its radius:

- **Movement:** stops.
- **Current action:** canceled. A Sentinel or enemy Commander loses its charge; a Duelist's lunge ends without a slash.
- **Shield:** dropped, and cannot rise.
- **Heal pulse:** a Healer's timer pauses.

The EMP also deletes every enemy projectile within its radius.

A Plasma Mortar shell stuns enemy units within its `stun.radius` (80) of the landing point for `stun.time` (1 s) after its blast, with the same effects, and exposes them for as long: every hit from the ace's side deals × `stun.exposedMul` (1.5).

A **unit action** is something a unit does over time, one per unit:

- **Lance charge (Sentinel; enemy Commander's mega-beam):** the sight line tracks for `charge` seconds (1.2; 1.5), freezes for the last `lock` seconds (0.35; 0.45), then strikes every hostile unit within `width` of the line (5; 28).
- **Saber lunge (Duelist):** a dash of up to 0.22 s, then an arc slash.

A unit running an action fires nothing else. A saber lunge also takes over its movement; during a lance charge the unit keeps moving.

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
- **Invulnerability:** 0.28 s (a longer one already running is kept).
- **Exit speed:** full top speed in the dash direction (`dashCarry` 1).
- **Recharge:** the frame's `dashCd` (1.4–3.2 s).
- **Weapons:** do not fire during a dash.

### Close dodge

A hostile attack that touches the ace during a dash's invulnerability (a shot passing through, a lance, a blast, a slash) is a close dodge, once per dash:

- The dash recharge is refunded (`dodge.dashRefund`: all of it).
- The super release gauge gains 15% (`dodge.releaseCharge`).
- A DODGE callout shows, with a short hit-stop.

The invulnerability that opens a super release does not count unless a dash started during it. The result card counts close dodges.

### Regeneration

After `regenDelay` (4 s) without damage, the ace regains `regenPerSecond` (3%) of max HP per second. Any hit resets the delay.

### Statuses

Timed effects on the ace. A status can multiply stats, heal per second, draw a ring around the ace, and make every weapon fire. Using the same tool again refreshes its status instead of stacking it. Multipliers from different statuses multiply together.

| Status | Source | Effect |
| --- | --- | --- |
| Overboost | Overboost tool | Speed ×1.7, time between shots ×0.6, damage taken ×0.7, for 4 s |
| Repair | Repair Nanites | Heals 35% of max HP over 3 s |
| Super release | Space | Every weapon hardpoint fires and the ace takes ×0.5 damage, for 3 s |

## Firing

Each step, for the ace:

1. **Background reloads.** Every hardpoint's timers run down, including inactive weapons.
2. **Reticle.** Every 0.12 s the aim mode picks the best target within the active weapon's range. The ace faces its target, or its movement direction when it has none.
3. **Fire.** The active weapon fires if it has ammo, is not reloading, is off cooldown, and the ace is not lunging, nor dashing (unless the weapon has `fireWhileDashing`: the Assault Rifle). During super release every weapon hardpoint does this, each with its own target in its own range.
4. **Cooldown.** After a shot, the next waits `interval` × the frame's `rateMul` × statuses' `fireInterval` × the weapon's movement factor (1 + (`movingFireInterval` − 1) × speed share, Beam Rifle) ÷ its spin rate (`spin.start` rising to `spin.top`, Gatling). An empty magazine starts a reload of `reload` × the frame's `reloadMul`.

The speed share is the ace's speed ÷ its top speed (Overboost included), capped at 1.

**Spin-up** (`spin`): while the weapon's last shot was under 0.2 s ago, its spin rises by 1 ÷ `upTime` per second; otherwise it falls by 1 ÷ `downTime` per second (0–1). During super release it is 1.

**Heat** (`heat`): `mag` is the shots to overheat, and an empty magazine is the overheat lockout (`reload`). Once the weapon has not fired for `coolDelay`, its rounds refill by `coolPerSecond` per second. During super release it stays full.

**Steady aim** (Railgun `steady`): damage × (`still` + (`moving` − `still`) × speed share).

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

### Super release

The gauge (0–1) must be full. It starts full and empties on use. While no release runs it gains `charge.perKill` (1.2%) per enemy the ace destroys (× `closeKillMul` 2.5 within `closeRadius` 320 of the ace), `charge.perSecond` (1.6%) per second, and 15% per close dodge. Nothing charges it during a release.

Starting a release:

1. Fires the opening burst (below).
2. Adds the super release status for `duration` (3 s): every weapon hardpoint fires, damage taken × `damageTakenMul` (0.5).
3. Gives `openingIframes` (0.6 s) of invulnerability and makes the dash ready.
4. Starts every tool hardpoint's release effect. EMP and Decoy repeat at their `releaseInterval` until the release ends ([weapons.md](weapons.md#tools)).
5. Lands a release impact.

When it ends with 10 or more kills, a banner and a ×N callout show the count.

### The super release burst

Each weapon hardpoint launches

```
count = max(1, round(openingBurst × roundsPerShot ÷ (interval × frame rateMul)))
```

rounds at once. `openingBurst` is 2.5 s. `roundsPerShot` is the pellet count for the Breach Cannon, the salvo size for the Missile Pod, and 1 otherwise. Each round goes in a random direction within the weapon's `burstArc` around the facing (360° by default, 60° for the Beam Rifle and Railgun), at a randomly varied speed. The burst ignores ammo and needs no target. Burst missiles take one enemy in range each before any target repeats.

## Clash and knockback

**Clash:** saber meets saber. It happens when the ace's slash reaches an enemy whose saber lunge is in progress, or when an enemy's saber slash reaches the ace while the ace's active weapon is a saber. Neither cuts the other (the rest of each slash still hits other units). The ace's lunge ends and its velocity is set to `clash.acePush` (420) away from the enemy; the enemy is knocked back at `clash.unitPush` (520) the other way over `clash.pushTime` (0.25 s). The `impact.clash` hit-stop marks it.

**Knockback:** a knocked-back unit slides along its push, slowing linearly to a stop over the push time. The knockback replaces the unit's current action (a lance charge or lunge is lost) and holds its AI until it ends. The Breach Cannon's blast and a clash knock units back.

## AI

Target priority, movement, firing and leashes: [units.md](units.md#ai-behavior). Stalking and packs: [units.md](units.md#stalking-and-packs).

## Battle flow

- **Deployment:** [units.md](units.md#deployment-and-reinforcements).
- **Reinforcements:** while reserves remain, a battalion enters from the east edge at a random height when the reserve timer (25 s) expires or the enemies on the field drop below 150. The timer restarts with each battalion.
- **Alerts:** one-time banners when half the allies are down, when all are down, when the final reserves deploy, and when the ace drops below 25% HP (re-armed above 50%).
- **Victory:** no enemy on the field and none in reserve.
- **Defeat:** the ace is destroyed. Losing all allies is not a defeat.
- **Praise:** banners every 100 ace kills and for 25 kills within 4 s (then none for 15 s; not during a release). They never replace a banner still on show.
- **Rating:** on victory, rating = `pointsPerEnemy` (10) × enemy total × pace × integrity × allied line, where pace = par time (`parSecondsPerEnemy` 0.55 × enemy total) ÷ clear time, clamped to 0.5–1.5; integrity = 1 − `damagePerMaxHp` (0.08) × damage taken ÷ max HP, at least 0.5; allied line = 1 + `lineBonus` (0.3) × allies alive ÷ allied total. The rank letter is the first `rating.ranks` entry whose `minScore` the rating per enemy reaches: S 10.5, A 8.5, B 6.5, otherwise C.

## Impact

Big moments land with hit-stop, screen shake and a screen flash (`battle.json` → `impact`):

| Impact | When |
| --- | --- |
| `bigKill` | The ace destroys a class with `killBanner` |
| `heavyHit` | One hit takes `minShare` (8%) of the ace's max HP or more |
| `release` | Super release starts |
| `dodge` | A close dodge |
| `slash` | One of the ace's saber slashes connects |
| `aceDeath` | The ace is destroyed; then slow motion |
| `aceHit` | Any hit that lands on the ace, scaled by damage (full at `fullShare`, 6% of max HP). The ace also jolts for `react` (0.18 s) and a red ring pops off it |
| `blast` | A blast of radius `minRadius` (100) or more within `range` (600) of the ace; strength fades with distance |
| `beam` | A hostile line attack at least `minWidth` (20) wide passing within `range` (450) of the ace (the mega-beam); strength fades with distance |

- **Hit-stop:** for `freeze` seconds the simulation holds. Effects keep aging, the camera keeps following, and shake and flash keep settling. A new hit-stop waits `freezeGap` (0.3 s) after the last one ends, except the ace's destruction.
- **Slow motion:** after the ace's hit-stop, the battle runs at × `slowScale` (0.3) for `slow` (1.2 s) of real time.
- **Shake and flash:** the stronger value wins. Shake settles over `shakeTime`; the flash fades over `flashTime`. Rendering reads them.
- **Hurt edges:** an impact's `hurt` (0–1) reddens the screen edges, fading over `hurtTime` (0.45 s).
- **Stagger:** an ace hit of `stagger.minDamage` (60) or more makes the unit judder for `stagger.time` (visual only).

## Determinism

- **Seeded randomness.** All simulation randomness (deployment jitter, army order, retarget timers, spread, burst directions) comes from one seeded generator on the world. `?seed=N` in the URL fixes the seed; the console logs each battle's seed. Hit-stop and slow motion are part of the simulation, so they replay too.
- **Replays.** The same seed with the same sequence of `dt` values reproduces a battle exactly.
- **Live play.** In the browser the step follows the frame rate, so a live battle also depends on frame timing.

## Related

- [reference.md](reference.md#battle-rules): rule values
- [data.md](data.md): files and fields
- [architecture.md](architecture.md): code structure
- [glossary.md](glossary.md): terms
