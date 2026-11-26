# Ace equipment

The ace's loadout is a **frame**, four **hardpoints** filled from 9 weapons and 4 tools, and an **aim mode**. Exact values are in [reference.md](reference.md#ace-weapons).

## Hardpoints

- The ace has four hardpoints. All four must be filled, and at least one must hold a weapon.
- **Active weapon.** One weapon is active at a time. It fires automatically at the aim mode's target whenever that target is in range and the weapon is ready.
- **Switching.** 1–4 (or a tap on the hardpoint) selects a weapon. Switching is instant.
- **Reloading.** Inactive weapons keep reloading. R reloads the active weapon before its magazine is empty.
- **Tools.** A tool fires once when its key is pressed, then recharges. Pressing a recharging tool has no effect. During super release every tool hardpoint runs its release effect instead ([Super release](#super-release)).
- **Frame scaling.** The frame multiplies the time between shots, reload time and tool recharge.

## Weapons

| Weapon | Type | Range | Mechanism |
| --- | --- | --: | --- |
| Weapon | Type | Range | Mechanism | Plays best |
| --- | --- | --: | --- | --- |
| Assault Rifle | Kinetic | 400 | Automatic fire. Each round pierces 2 units. Keeps firing during a dash | Anywhere |
| Gatling Cannon | Kinetic | 360 | Spins up from a trickle to a torrent while it keeps firing. Heat instead of a magazine | Planted, firing nonstop |
| Beam Rifle | Beam | 600 | Fast beam that pierces 4 units. Fires faster the faster the ace moves | On the move |
| Railgun | Kinetic | 760 | Instant hit along the whole range on every unit on the line. Hits hardest from a standstill | Holding still at range |
| Missile Pod | Blast | 600 | Salvo of 8 homing missiles, each on a different target. Splash | Anywhere |
| Breach Cannon | Kinetic | 280 | 10 pellets per shot; every 4th shot also a point-blank blast that throws enemies back and kicks the ace clear | In the crowd |
| Plasma Mortar | Blast | 580 | Lobbed shell aimed where the target is heading. Splash only; the center stuns and exposes | Setting up other weapons |
| Beam Saber | Beam | 165 | Lunge and arc slash. Clashes with enemy sabers. No magazine | In the crowd |

### Assault Rifle

28 damage per round, 0.11 s between shots, magazine 40. Each round passes through 2 units and hits up to 3. Two hits destroy a normal ALTER (28 × 1.5 = 42 against 75 HP). The only weapon that fires during a dash.

### Gatling Cannon

20 damage per round, each piercing 1 unit. The base time between shots is 0.06 s.

- **Spin-up:** the fire rate starts at ×0.35 and rises to ×1.5 over 2 s of continuous fire. It falls back over 0.8 s once the gun stops, which a dash or switching weapons does.
- **Heat:** 150 shots overheat it, locking it for 3 s. Once it has not fired for 0.4 s it cools by 60 shots' worth per second. The HUD shows heat and the current fire rate.
- **During super release:** it runs at full spin and builds no heat.

### Beam Rifle

70 damage per beam, range 600, pierces 4 units. 0.55 s between shots at a standstill, down to ×0.6 of that at top speed (linear in speed). Magazine 8. ×1.5 against heavy plate, ×0.5 against beam coating.

### Railgun

An instant line to 760 that deals 280 to every unit on it, × 1.5 when the ace fires from a standstill down to × 0.6 at top speed (linear in speed). The line is drawn thicker the harder it hits, and the reticle's brackets open as the ace speeds up. 1.3 s between shots, magazine 3, reload 3.2 s. Its range is below the 800 at which hunters target the ace.

### Missile Pod

A salvo of 8 missiles, 22 damage each, with a splash of radius 55 for 12. The missiles launch backwards, fly straight for 0.2 s, then turn and home. Each missile takes a different target, ranked by the aim mode. With fewer targets than missiles, targets are shared. A missile whose target dies picks a random enemy nearby. The magazine counts missiles (20).

### Breach Cannon

10 pellets of 40 damage per shot, spread ±14°, pellet speeds varied. 0.62 s between shots, magazine 8, reload 2.2 s.

Every 4th shot of a magazine (the 4th and 8th) also fires a blast centered 90 in front of the ace: radius 160, 150 damage falling off to half at the edge. Every enemy in it is thrown away from the ace (starting at 500, slowing to a stop over 0.22 s), which cancels a lance charge or a lunge. The ace is kicked back at 280.

### Plasma Mortar

No direct damage. The shell flies for 0.9 s and lands where its target is heading. A ground marker shows the spot. Splash radius 180 for 105. Magazine 2, reload 4.2 s.

After the blast, enemies within 80 of the landing point are stunned for 1 s (which also drops a semi-ace's shield) and **exposed** for as long: hits from the ace and allied units deal ×1.5. The ace's hits on an exposed enemy are marked EXPOSED.

### Beam Saber

When a target is within 165, the ace lunges at it and slashes every enemy within 150 in a 126° arc in front (and anything within 45), for 140 damage. Each lunge starts with 0.12 s of invulnerability. A slash that connects lands with a brief hit-stop. No magazine; never reloads.

**Clash:** saber meets saber. If the ace's slash catches an enemy mid-swing with its own saber (a Duelist's lunge), or an enemy saber slash reaches the ace while the Beam Saber is the active weapon, neither cuts. The ace bounces away at 420 and its lunge ends; the enemy is knocked back the other way at 520, losing its lunge. A CLASH callout and a hit-stop mark it.

### Splash and piercing

- **Splash** hits every hostile unit whose edge is inside the radius. Damage falls off linearly from full at the center to half at the edge, and uses the damage type of the weapon that caused it.
- **Piercing:** a round that "pierces N" hits up to N + 1 units.

## Tools

| Tool | Effect | Recharge | During super release |
| --- | --- | --: | --- |
| Repair Nanites | Restores 35% of max HP over 3 s | 22 s | Restores 35% of max HP over the release, on top of a repair already running |
| EMP Burst | Stuns every enemy within 300 for 3 s and deletes enemy shots within 300 | 16 s | A burst at the start and every 1 s |
| Decoy Beacon | Places a beacon (600 HP) for 8 s. Enemy units within 650 target it | 20 s | An afterimage beacon (200 HP, 2.5 s) at the start and every 0.75 s |
| Overboost | For 4 s: speed ×1.7, time between shots ×0.6, damage taken ×0.7 | 18 s | Runs for the whole release (a longer Overboost already running is kept) |

Recharge times are before the frame's multiplier. Release effects run whatever the tool's recharge and do not start it. Overboost and Repair show as HUD chips; Overboost and super release show as a ring around the ace while active.

A stun stops a unit, cancels its current action (a Sentinel's lance charge, a Duelist's lunge) and drops a semi-ace's shield.

## Frames

| Frame | Type | Top speed | HP | Time between shots | Reload time | Tool recharge | Dash recharge |
| --- | --- | --: | --: | --: | --: | --: | --: |
| Swift | Speed | 300 | 190 | ×1 | ×1 | ×1 | 1.4 s |
| Quickdraw | Fast-loading | 190 | 240 | ×0.8 | ×0.45 | ×0.7 | 3.2 s |
| Vanguard | Balance | 245 | 220 | ×0.9 | ×0.72 | ×0.85 | 2.2 s |

Acceleration scales with top speed, so Swift also accelerates and turns fastest.

## Aim modes

The aim mode selects the target from enemies inside the **active weapon's** range. The target is re-picked every 0.12 s.

| Key | Mode | Picks |
| --- | --- | --- |
| 5 | Closest | The nearest enemy |
| 6 | Furthest | The farthest enemy in range |
| 7 | Lowest HP | The enemy with the least HP |
| 8 | Strongest | Highest class rank (Commander, then semi-aces, then Bulwark…), then most HP |
| 9 | Densest pack | The enemy with the most enemies in the surrounding 3 × 3 grid cells |
| 0 | Attacking me | An enemy currently targeting the ace. Falls back to Closest |

Q and E cycle through the modes in this order. Ties are broken by distance.

## Damage types

Each weapon deals one damage type. Each unit class wears one armor. The ace has no armor class.

| | Standard | Heavy plate | Beam coating | Reactive armor |
| --- | --: | --: | --: | --: |
| **Kinetic** | ×1 | ×0.5 | ×1 | ×1.5 |
| **Beam** | ×1 | ×1.5 | ×0.5 | ×1 |
| **Blast** | ×1 | ×1 | ×1.5 | ×0.5 |

| Armor | Worn by |
| --- | --- |
| Standard | Trooper, Beam Trooper, Striker, Lancer, Sentinel, Hornet, Marksman, Commander |
| Heavy plate | Bulwark, Circus |
| Beam coating | Prism, Duelist |
| Reactive armor | Breacher |

| Type | Ace weapons |
| --- | --- |
| Kinetic | Assault Rifle, Gatling Cannon, Railgun, Breach Cannon |
| Beam | Beam Rifle, Beam Saber |
| Blast | Missile Pod, Plasma Mortar |

## Super release

Space, when the super release gauge is full. The gauge is full at the start of a sortie and empties on use. It refills while no release runs:

| Source | Gauge |
| --- | --: |
| An enemy destroyed by the ace | 1.2% (×2.5 within 320 of the ace) |
| A close dodge ([mechanics.md](mechanics.md#close-dodge)) | 15% |
| Time | 1.6% per second |

When it starts:

- The ace is invulnerable for 0.6 s and takes ×0.5 damage for the whole release.
- The dash is ready at once.
- Every tool hardpoint runs its release effect ([Tools](#tools)).

1. **Opening burst.** Every weapon hardpoint launches 2.5 s worth of its fire at once (scaled by the frame's fire rate). The burst uses no ammo and needs no target.

   | Weapon | Burst |
   | --- | --- |
   | Assault Rifle, Gatling Cannon | Rounds in random directions all around the ace, at varied speeds |
   | Breach Cannon | Pellets all around, and one blast around the ace (radius ×1.3) that throws every enemy in it back |
   | Beam Rifle, Railgun | Random directions within 60° in front of the ace |
   | Missile Pod | Missiles in random directions; each then homes on a different enemy in range |
   | Plasma Mortar | Shells land at random points around the ace |
   | Beam Saber | One 360° slash |

2. **Barrage.** For 3 s every weapon hardpoint fires at once. Each weapon picks its own target in its own range by the current aim mode, with its own fire rate, ammo and reload.

The formula is in [mechanics.md](mechanics.md#the-super-release-burst).

## Related

- [reference.md](reference.md#ace-weapons): every weapon, tool and frame value
- [mechanics.md](mechanics.md#firing): cooldowns, reloads and targeting
- [architecture.md](architecture.md#a-new-weapon-behavior): adding a weapon
