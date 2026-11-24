# Ace equipment

The ace's loadout is a **frame**, four **hardpoints** filled from 9 weapons and 4 tools, and an **aim mode**. Exact values are in [reference.md](reference.md#ace-weapons).

## Hardpoints

- The ace has four hardpoints. All four must be filled, and at least one must hold a weapon.
- **Active weapon.** One weapon is active at a time. It fires automatically at the aim mode's target whenever that target is in range and the weapon is ready.
- **Switching.** 1–4 (or a tap on the hardpoint) selects a weapon. Switching is instant.
- **Reloading.** Inactive weapons keep reloading. R reloads the active weapon before its magazine is empty.
- **Tools.** A tool fires once when its key is pressed, then recharges. Pressing a recharging tool has no effect.
- **Frame scaling.** The frame multiplies the time between shots, reload time and tool recharge.

## Weapons

| Weapon | Type | Range | Mechanism |
| --- | --- | --: | --- |
| Assault Rifle | Kinetic | 400 | Automatic fire. Each round pierces 2 units |
| Gatling Cannon | Kinetic | 360 | Rapid fire with wide spread. 150-round magazine, 3.5 s reload. Each round pierces 1 unit |
| Scatter Cannon | Kinetic | 310 | 12 pellets per shot in a ±11° cone, at varied speeds |
| Beam Rifle | Beam | 600 | Fast beam. Each beam pierces 4 units (hits 5) |
| Railgun | Kinetic | 760 | Instant hit along the whole range. Damages every unit on the line |
| Missile Pod | Blast | 600 | Salvo of 8 homing missiles, each on a different target. Splash |
| Bazooka | Blast | 440 | Single rocket. Splash |
| Plasma Mortar | Blast | 580 | Lobbed shell aimed where the target is heading. Splash only |
| Beam Saber | Beam | 120 | Lunge and arc slash. No magazine |

### Assault Rifle

28 damage per round, 0.11 s between shots, magazine 40. Each round passes through 2 units and hits up to 3. Two hits destroy a normal ALTER (28 × 1.5 = 42 against 75 HP).

### Gatling Cannon

20 damage per round, 0.045 s between shots. Magazine 150, reload 3.5 s. Each round pierces 1 unit.

### Scatter Cannon

12 pellets of 34 damage per shot, spread ±11°, pellet speeds varied. 0.65 s between shots, magazine 8.

### Beam Rifle

70 damage per beam, range 600, pierces 4 units. 0.55 s between shots, magazine 8. ×1.5 against heavy plate, ×0.5 against beam coating.

### Railgun

An instant line to 760 that deals 280 to every unit on it. 1.3 s between shots, magazine 3, reload 3.2 s. Its range is below the 800 at which hunters target the ace.

### Missile Pod

A salvo of 8 missiles, 22 damage each, with a splash of radius 55 for 12. The missiles launch backwards, fly straight for 0.2 s, then turn and home. Each missile takes a different target, ranked by the aim mode. With fewer targets than missiles, targets are shared. A missile whose target dies picks a random enemy nearby. The magazine counts missiles (20).

### Bazooka

A single rocket, 100 damage on a direct hit, with a splash of radius 117 for 70. 0.95 s between shots, magazine 4.

### Plasma Mortar

No direct damage. The shell flies for 0.9 s and lands where its target is heading. A ground marker shows the spot. Splash radius 180 for 95. Magazine 2, reload 4.2 s.

### Beam Saber

When a target is within 120, the ace lunges at it and slashes every enemy within 105 in a 92° arc in front, for 120 damage. Each lunge starts with 0.12 s of invulnerability. No magazine; never reloads.

### Splash and piercing

- **Splash** hits every hostile unit whose edge is inside the radius. Damage falls off linearly from full at the center to half at the edge, and uses the damage type of the weapon that caused it.
- **Piercing:** a round that "pierces N" hits up to N + 1 units.

## Tools

| Tool | Effect | Recharge |
| --- | --- | --: |
| Repair Nanites | Restores 35% of max HP over 3 s | 22 s |
| EMP Burst | Stuns every enemy within 300 for 3 s and deletes enemy shots within 300 | 16 s |
| Decoy Beacon | Places a beacon (600 HP) for 8 s. Enemy units within 650 target it | 20 s |
| Overboost | For 4 s: speed ×1.7, time between shots ×0.6, damage taken ×0.7 | 18 s |

Recharge times are before the frame's multiplier. Overboost, Repair and super release show as HUD chips and as a ring around the ace while active.

A stun stops a unit, cancels its current action (a Sentinel's lance charge, a Duelist's lunge) and drops a semi-ace's shield.

## Frames

| Frame | Type | Top speed | HP | Time between shots | Reload time | Tool recharge | Dash recharge |
| --- | --- | --: | --: | --: | --: | --: | --: |
| Swift | Speed | 300 | 380 | ×1 | ×1 | ×1 | 1.4 s |
| Quickdraw | Fast-loading | 190 | 480 | ×0.8 | ×0.45 | ×0.7 | 3.2 s |
| Vanguard | Balance | 245 | 440 | ×0.9 | ×0.72 | ×0.85 | 2.2 s |

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
| Kinetic | Assault Rifle, Gatling Cannon, Scatter Cannon, Railgun |
| Beam | Beam Rifle, Beam Saber |
| Blast | Missile Pod, Bazooka, Plasma Mortar |

## Super release

Space. Available at the start of a sortie; recharges 30 s after each use.

1. **Opening burst.** Every weapon hardpoint launches 2.5 s worth of its fire at once (scaled by the frame's fire rate). The burst uses no ammo and needs no target.

   | Weapon | Burst |
   | --- | --- |
   | Assault Rifle, Gatling Cannon, Scatter Cannon, Bazooka | Rounds in random directions all around the ace, at varied speeds |
   | Beam Rifle, Railgun | Random directions within 60° in front of the ace |
   | Missile Pod | Missiles in random directions; each then homes on a different enemy in range |
   | Plasma Mortar | Shells land at random points around the ace |
   | Beam Saber | One 360° slash |

2. **Barrage.** For 3 s every weapon hardpoint fires at once. Each weapon picks its own target in its own range by the current aim mode, with its own fire rate, ammo and reload. Tools do not fire.

The formula is in [mechanics.md](mechanics.md#the-super-release-burst).

## Related

- [reference.md](reference.md#ace-weapons): every weapon, tool and frame value
- [mechanics.md](mechanics.md#firing): cooldowns, reloads and targeting
- [architecture.md](architecture.md#a-new-weapon-behavior): adding a weapon
