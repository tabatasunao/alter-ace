# Mechanics

The rules the simulation runs. Values quoted are the current data; [reference.md](reference.md) has every value and [data.md](data.md) names the field for each. Code locations are in [architecture.md](architecture.md).

## Simulation step

The battle is a headless simulation (`src/sim`), stepped once per animation frame with `dt` capped at 0.05 s. Each step runs 23 systems in a fixed order: grid rebuild, separation, army centers, auras, heal pulses, shields, ace statuses, Full Arms, ace movement, ace weapons, stalking, unit AI, unit actions, projectiles, effects, impact, clock, reinforcements, alerts, praise, victory, cleanup, camera ([architecture.md](architecture.md#battle-pipeline)). During hit-stop only effects, impact and camera run; during slow motion every system gets a scaled `dt` ([Impact](#impact)). Rendering and the HUD read the world and never change it.

## Damage

A **hit** carries its source (`player` or `army`), weapon id, damage type, and whether a semi-ace fired it.

When a hit lands, the target runs its kind's **damage rules** in order. Each rule scales the amount or cancels the hit.

| Target | Rules, in order |
| --- | --- |
| **The ace** | × `aceDamageTaken` (0.5) × running statuses' `damageTaken` (Full Arms: 0.5) → record the hit (stats; resets the regeneration delay) → hit reaction (every hit, scaled by damage, full at 6% of max HP) → heavy-hit impact (a hit of 8% of max HP or more) |
| **An AI unit** | Shield (may cancel) → army softening (`army` hits × `unitVsUnit`, 0.15, × the weapon's `armyMul`: Marksman 4, Circus 6) → ace vulnerability (× `aceHitMul` if the hit is the ace's or a semi-ace's) → armor (× the armor's value for the damage type) → exposed (× `exposedMul` while a stun lasts) → stagger (an ace hit of 60 or more makes the unit judder; visual only) |

The result is subtracted from HP. At 0 HP the unit dies.

The ace's body is 22 across (`player.size`), so a shot hits it within 11 plus the shot's radius. The ace cannot be hit while it has invulnerability frames, which start with a dash (0.28 s), a Beam Saber lunge (0.12 s) or Full Arms (0.6 s). Shots pass through it.

AI fire at the ace sharpens up close (close-quarters fire, `ai.closeAim`): within `range` (400) of the ace, a unit's lead rises toward `lead` (1, the full intercept; a weapon that leads more keeps its own), its spread narrows toward × `spread` (0.3) and its fire rate rises toward × `fireRate` (2), each linear in closeness (1 − distance ÷ range). Lances keep their own lead.

Charged attacks at the ace take turns (`ai.aceCharges`): at most `max` (2) units charge a lance at the ace at once. A new charge fires at least `gap` (0.6 s) after the latest one already scheduled; its tracking phase runs longer to make room. A unit without a turn holds fire and retries after `retry` (0.5 s). A holder that dies, is stunned or fires gives its turn back.

### Examples

| Hit | Calculation | Result |
| --- | --- | --- |
| A Shotgun pellet (46 Kinetic) on an enemy Trooper (75 HP) | 46 × 1.5 (normal ALTER) × 1 (standard) | 69 (2 pellets) |
| A Shotgun pellet on a Bulwark (320 HP) | 46 × 0.5 (heavy plate) | 23 (14 pellets), RESIST |
| The Sniper Rifle (400 Beam) on a Bulwark | 400 × 1.5 | 600 (1 hit), CRITICAL |
| Enemy Trooper's rifle (5 Kinetic) on an allied Trooper | 5 × 0.15 (army) | 0.75 |
| Enemy Duelist's saber (40 Beam) on an allied Trooper | 40 × 0.15 × 1.5 (semi-ace) | 9 |
| Enemy Marksman's beam (18 Beam) on an allied Trooper | 18 × 0.15 × 4 (`armyMul`) × 1.5 | 16.2 |
| The same beam on the ace | 18 × 0.5 | 9 |
| Enemy Trooper's rifle on the ace | 5 × 0.5 | 2.5 |
| The same, during Full Arms | 5 × 0.5 × 0.5 | 1.25 |

### Splash

A blast hits every hostile unit whose edge is inside its radius. Damage falls off linearly from full at the center to half at the edge. Each unit reached runs its damage rules with the damage type of the weapon that caused the blast.

### Markers

When a unit's defenses change one of the **ace's** hits, the hit shows a marker: CRITICAL when the armor multiplier is above 1, RESIST when it is below 1, SHIELD when a shield blocks it. Labels are limited to one per unit every 0.45 s. Army hits show no markers.

### Death and scoring

A destroyed unit leaves debris, plus a blast for large units. Then:

- **Enemy death:** the enemy count drops. If the killing hit came from an ace weapon (direct or splash), it counts as the ace's kill and in that weapon's tally, and charges the Full Arms gauge. Classes with `killBanner` (Commander, semi-aces) show a banner; an ace kill of one is a big-kill impact.
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

Stuns come from shells of the `mortar` weapon behavior: after its blast, enemy units within its `stun.radius` of the landing point are stunned for `stun.time`. No current weapon uses that behavior. A stun:

- **Movement:** stops.
- **Current action:** canceled. A Sentinel or enemy Commander loses its charge; a Duelist's wind-up or lunge ends without a slash.
- **Shield:** dropped, and cannot rise.
- **Heal pulse:** a Healer's timer pauses.
- **Exposed:** for as long, every hit from the ace's side deals × `stun.exposedMul`.

A **unit action** is something a unit does over time, one per unit:

- **Lance charge (Sentinel; enemy Commander's mega-beam):** the sight line tracks for `charge` seconds (1.2; 1.5), freezes for the last `lock` seconds (0.35; 0.45), then strikes every hostile unit within `width` of the line (5; 28).
- **Saber lunge (Duelist):** a dash of up to 0.22 s, then an arc slash, then a hop back of 120 over 0.16 s.
- **Dash strike (Duelist):** at a target 136–420 away, once every 5 s. The Duelist stands for 0.55 s while its aim line tracks the target, frozen for the last 0.3 s; it then dashes at 1300 to where the line points (stopping 18 short) and slashes for 60, then hops back. Against the ace it needs a charge turn (`ai.aceCharges`), like a lance.

A unit running an action fires nothing else. A saber lunge also takes over its movement; during a lance charge the unit keeps moving.

## The ace

### Movement

Model `thruster` (`player.movement.model`):

- **Thrust:** input accelerates the ace; standstill to top speed takes 0.8 s.
- **Drag:** with no input the ace coasts, losing speed at 0.6/s (it halves about every 1.2 s).
- **Lateral drag:** sideways velocity fades at 0.4/s while thrusting.
- **Top speed:** the frame's `speed`, × running statuses' `speed`. Acceleration scales with top speed.
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
- The Full Arms gauge gains 15% (`dodge.releaseCharge`).
- A DODGE callout shows, with a short hit-stop.

The invulnerability that opens Full Arms does not count unless a dash started during it. The result card counts close dodges.

### Regeneration

After `regenDelay` (4 s) without damage, the ace regains `regenPerSecond` (3%) of max HP per second. Any hit resets the delay.

### Statuses

Timed effects on the ace. A status can multiply stats (`speed`, `fireInterval`, `damageTaken`), draw a ring around the ace, and make every weapon fire. Adding a status with the same id replaces it. Multipliers from different statuses multiply together.

| Status | Source | Effect |
| --- | --- | --- |
| Full Arms | Space | Every weapon hardpoint fires and the ace takes ×0.5 damage, for 3 s |

## Firing

Each step, for the ace:

1. **Background reloads.** Every hardpoint's timers run down, including inactive weapons.
2. **Reticle.** Every 0.12 s the aim mode picks the best target within the active weapon's range. The ace faces its target, or its movement direction when it has none.
3. **Fire.** The active weapon fires if it has ammo, is not reloading, is off cooldown, and the ace is not lunging, nor dashing (unless the weapon has `fireWhileDashing`). During Full Arms every weapon hardpoint does this, each with its own target in its own range.
4. **Cooldown.** After a shot, the next waits `interval` × the frame's `rateMul` × statuses' `fireInterval` × the weapon's movement factor (1 + (`movingFireInterval` − 1) × speed share) × its `fullArmsFireInterval` while Full Arms runs (Shotgun and Beam Saber: 0.5). An empty magazine starts a reload of `reload` × the frame's `reloadMul`.

The speed share is the ace's speed ÷ its top speed (statuses included), capped at 1.

**Steady aim** (Railgun `steady`): damage × (`still` + (`moving` − `still`) × speed share). Under `fullBelow` (10%) of top speed: damage × `still` × `fullBonus` (1.5 × 1.2 = 1.8). Speed share is speed ÷ top speed; a coasting ace slows at `drag` (0.6 per second).

**Frame build:** each stat's value is `min` + (`max` − `min`) × points ÷ `maxPerStat` (frames.json). Speed gives top speed, HP max HP, reload the reload multiplier, fire rate the time-between-shots multiplier, dash the dash recharge. A saved build is clamped to whole points from 0 to `maxPerStat`, and if it spends more than `points` the stats with the most give points back first.

**Camera zoom:** the battle camera eases toward the player's zoom × the active weapon's `viewZoom` (Sniper Rifle 0.7) × the Beam Saber's `swingZoom` (1.12) during a lunge and for 0.3 s after, never below `minZoom`.

**Sniper Rifle** (`sniper`): the beam deals `dmg` to the top-ranked target; enemies in front of it are passed by. When a hit kills, the next enemy on the line behind it takes the damage left over: `dmg` × (dealt − HP it had) ÷ dealt, where dealt is the damage after armor and other rules. The sight line is drawn for the last `sight` (0.45 s) of the cooldown; it does not delay the shot.

**Mortar tracking** (`mortar` behavior, `track`): each step of a shell's flight its landing point moves toward the target's position plus its velocity × the remaining flight × `leadFactor`, at up to `track` per second.

**Knockback on hit** (Shotgun `knock`): a pellet that hits an AI unit knocks it back along the pellet's path at `knock.push` (160), slowing to a stop over `knock.time` (0.12 s). Each Shotgun shot also jolts the ace away from the target: it moves `jolt.distance` (10) over `jolt.time` (0.05 s) on top of its other movement, then keeps `jolt.carry` (60) of velocity away from the target; and the `impact.shotgun` shake plays.

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

### Full Arms

The gauge (0–1) must be full. It starts at `charge.start` (50%) and empties on use. While Full Arms is not running it gains `charge.perKill` (1.2%) per enemy the ace destroys (× `closeKillMul` 2.5 within `closeRadius` 320 of the ace), `charge.perSecond` (1.6%) per second, 15% per close dodge, `charge.perHpTaken` (50%) per max HP of damage the ace takes, and a near-miss bonus. A near miss is enemy fire that passes within `charge.graze.radius` (36) of the ace's hull without touching it: `graze.perShot` (0.8%) per flying shot, counted once when the shot leaves that zone or runs out, and `graze.perLine` (6%) per lance or mega-beam. A shot that hits the ace, or touches it during a dash, gives no near-miss bonus. Nothing charges the gauge while Full Arms runs.

Starting Full Arms:

1. Fires the opening burst (below).
2. Adds the Full Arms status for `duration` (3 s): every weapon hardpoint fires, damage taken × `damageTakenMul` (0.5).
3. Gives `openingIframes` (0.6 s) of invulnerability and makes the dash ready.
4. Lands the Full Arms impact.

When it ends with 10 or more kills, a banner and a ×N callout show the count.

### The Full Arms burst

Each weapon hardpoint launches

```
count = max(1, round(openingBurst × roundsPerShot ÷ (interval × frame rateMul)))
```

rounds at once. `openingBurst` is 7.5 s. `roundsPerShot` is the pellet count for the Shotgun, the salvo size for the Missile Pod, and 1 otherwise. Each round goes in a random direction within the weapon's `burstArc` around the facing (360° by default, 60° for the Railgun and Sniper Rifle), at a randomly varied speed. The burst ignores ammo and needs no target. Burst missiles take one enemy in range each before any target repeats.

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
- **Praise:** banners every 100 ace kills and for 25 kills within 4 s (then none for 15 s; not while Full Arms runs). They never replace a banner still on show.
- **Rating:** on victory, rating = `pointsPerEnemy` (10) × enemy total × pace × integrity × allied line, where pace = par time (`parSecondsPerEnemy` 0.55 × enemy total) ÷ clear time, clamped to 0.5–1.5; integrity = 1 − `damagePerMaxHp` (0.08) × damage taken ÷ max HP, at least 0.5; allied line = 1 + `lineBonus` (0.3) × allies alive ÷ allied total. The rank letter is the first `rating.ranks` entry whose `minScore` the rating per enemy reaches: S 10.5, A 8.5, B 6.5, otherwise C.

## Impact

Big moments land with hit-stop, screen shake and a screen flash (`battle.json` → `impact`):

| Impact | When |
| --- | --- |
| `bigKill` | The ace destroys a class with `killBanner` |
| `heavyHit` | One hit takes `minShare` (8%) of the ace's max HP or more |
| `release` | Full Arms starts |
| `dodge` | A close dodge |
| `slash` | One of the ace's saber slashes connects |
| `railFull` | A full-strength Railgun shot (steady aim) hits at least one unit |
| `shotgun` | Each Shotgun shot (a slight shake) |
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
