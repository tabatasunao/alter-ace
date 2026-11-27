# Ace equipment

The ace's loadout is a **frame**, four **hardpoints** filled from 6 weapons, and an **aim mode**. Exact values are in [reference.md](reference.md#ace-weapons).

## Hardpoints

- The ace has four hardpoints. All four must be filled.
- **Active weapon.** One weapon is active at a time. It fires automatically at the aim mode's target whenever that target is in range and the weapon is ready.
- **Switching.** 1–4 (or a tap on the hardpoint) selects a weapon. Switching is instant.
- **Reloading.** Inactive weapons keep reloading. R reloads the active weapon before its magazine is empty.
- **Frame scaling.** The frame multiplies the time between shots and reload time.

## Weapons

The hangar groups the arsenal by damage type, each with its trait: kinetic weapons fire fast, beam weapons reach far (the Beam Saber, a melee weapon, is the exception), and blast weapons home in.

| Type | Weapons |
| --- | --- |
| **Kinetic**: fastest fire | Railgun, Shotgun |
| **Beam**: longest reach | Sniper Rifle, Beam Saber |
| **Blast**: homing | Bazooka, Missile Pod |

| Weapon | Type | Range | Mechanism |
| --- | --- | --: | --- |
| Bazooka | Blast | 500 | One rocket that curves gently onto its target. Wide splash |
| Railgun | Kinetic | 760 | Instant hit along the whole range on every unit on the line. Hits hardest from a standstill |
| Sniper Rifle | Beam | 1000 | A sight line, then an instant beam at one target. Punches on through what it kills |
| Shotgun | Kinetic | 266 | 11 pellets per shot. Each pellet that hits knocks the enemy back; each shot jolts the ace back |
| Beam Saber | Beam | 165 | Lunge and arc slash. Clashes with enemy sabers. No magazine |
| Missile Pod | Blast | 600 | Salvo of 8 homing missiles, each on a different target. Splash |

### Bazooka

One rocket per shot: 80 damage on impact and a splash of radius 105 for 72. It launches straight at the target and starts homing after 0.08 s, turning slowly (turn rate 2.2, against the Missile Pod's 6.5), so a fast target can slip it. A rocket whose target dies picks a random enemy nearby. 1.05 s between shots, magazine 4, reload 2.8 s.

### Railgun

An instant line to 760 that deals 220 to every unit on it, × 0.6 at top speed rising linearly to × 1.5 at rest. Under 10% of top speed the shot is at full strength: × 1.8 (× 1.5 with a 20% bonus). The shot is drawn as a slug: a white-hot dart that races down the line in 0.06 s, leaving a wake that thins and fades, with sparks at the muzzle. The hit itself is instant. The wake is wider the harder the shot hits. Strength shows in two more places:

- **The reticle's brackets:** thin at top speed, thick at rest. At full strength they snap in with a white flash.
- **An arc above the ace,** while the Railgun is the active weapon: it fills in the kinetic color as the ace slows. At full strength it turns white and thick, with a pulse when it gets there.

A full-strength shot has its own effect: two coils of discharge twist along the wake and a shock ring bursts off the muzzle. When it hits, it lands with a brief hit-stop and a small screen shake. 1 s between shots, magazine 3, reload 3.2 s. Its range is below the 800 at which hunters target the ace.

### Sniper Rifle

The longest reach: 1000, beyond the 800 at which hunters target the ace. While it is the active weapon the camera zooms out to ×0.7 of the chosen zoom, so targets at full range stay on screen. For the last 0.45 s before each shot a sight line in the beam color locks onto the target, brightening, and a ring closes around it. The shot is an instant beam at that target for 400. Enemies in front of the target are passed by. When the hit destroys the target, the damage left over carries on to the next enemy on the line, and so on while each hit kills. 1.3 s between shots, magazine 5, reload 2.8 s.

### Shotgun

11 pellets of 46 damage per shot, spread ±14°, pellet speeds varied, range 266. Each pellet that hits an enemy ALTER knocks it back along the pellet's path (starting at 160, slowing to a stop over 0.12 s), which cancels a lance charge or a lunge. Each shot jolts the ace 10 back in 0.05 s, then leaves it sliding back at 60, with a short screen shake. 0.62 s between shots, magazine 8, reload 2.2 s.

### Beam Saber

When a target is within 165, the ace lunges at it and slashes every enemy within 150 in a 126° arc in front (and anything within 45), for 140 damage. Each lunge starts with 0.12 s of invulnerability. A slash that connects lands with a brief hit-stop. During a lunge and for 0.3 s after, the camera zooms in to ×1.12. No magazine; never reloads.

**Clash:** saber meets saber. If the ace's slash catches an enemy mid-swing with its own saber (a Duelist's lunge), or an enemy saber slash reaches the ace while the Beam Saber is the active weapon, neither cuts. The ace bounces away at 420 and its lunge ends; the enemy is knocked back the other way at 520, losing its lunge. A CLASH callout and a hit-stop mark it.

### Missile Pod

A salvo of 8 missiles, 22 damage each, with a splash of radius 55 for 12. The missiles launch backwards, fly straight for 0.2 s, then turn and home. Each missile takes a different target, ranked by the aim mode. With fewer targets than missiles, targets are shared. A missile whose target dies picks a random enemy nearby. The magazine counts missiles (24).

### Splash and piercing

- **Splash** hits every hostile unit whose edge is inside the radius. Damage falls off linearly from full at the center to half at the edge, and uses the damage type of the weapon that caused it.
- **Piercing:** a round that "pierces N" hits up to N + 1 units.

## Frames

The player builds the frame: 25 points over five stats, up to 10 on each. Each point moves a stat a tenth of the way from its value with no points to its value with 10. Points need not all be spent.

| Stat | No points | 10 points |
| --- | --: | --: |
| Speed (top speed) | 180 | 310 |
| HP | 170 | 270 |
| Reload (reload time) | ×1 | ×0.45 |
| Fire rate (time between shots) | ×1 | ×0.8 |
| Dash (recharge) | 3.4 s | 1.2 s |

Acceleration scales with top speed. The player also names the ALTER (up to 16 characters; ALTER by default). The name shows on the HUD, in the launch bar and on the result card of a lost sortie.

| Preset | Speed | HP | Reload | Fire rate | Dash |
| --- | --: | --: | --: | --: | --: |
| Swift | 10 | 4 | 1 | 1 | 9 |
| Quickdraw | 1 | 5 | 10 | 9 | 0 |
| Vanguard | 5 | 5 | 5 | 5 | 5 |

A preset replaces the whole build. The default build is Vanguard's.

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
| Kinetic | Railgun, Shotgun |
| Beam | Sniper Rifle, Beam Saber |
| Blast | Bazooka, Missile Pod |

## Full Arms

Space, when the Full Arms gauge is full. The gauge is half full at the start of a sortie and empties on use. It refills while Full Arms is not running:

| Source | Gauge |
| --- | --: |
| An enemy destroyed by the ace | 1.2% (×2.5 within 320 of the ace) |
| A close dodge ([mechanics.md](mechanics.md#close-dodge)) | 15% |
| Time | 1.6% per second |

When it starts:

- The ace is invulnerable for 0.6 s and takes ×0.5 damage for all of Full Arms.
- The dash is ready at once.

1. **Opening burst.** Every weapon hardpoint launches 7.5 s worth of its fire at once (scaled by the frame's fire rate). The burst uses no ammo and needs no target.

   | Weapon | Burst |
   | --- | --- |
   | Shotgun | Pellets all around, at widely varied speeds, each knocking back what it hits |
   | Railgun | Random directions within 60° in front of the ace |
   | Sniper Rifle | Beams in random directions within 60° in front, each starting at the first enemy on its line |
   | Missile Pod, Bazooka | Rounds in random directions; each then homes on a different enemy in range |
   | Beam Saber | One 360° slash |

2. **Barrage.** For 3 s every weapon hardpoint fires at once. Each weapon picks its own target in its own range by the current aim mode, with its own fire rate, ammo and reload. The Shotgun and Beam Saber fire twice as fast while it runs.

The formula is in [mechanics.md](mechanics.md#the-full-arms-burst).

## Related

- [reference.md](reference.md#ace-weapons): every weapon and frame value
- [mechanics.md](mechanics.md#firing): cooldowns, reloads and targeting
- [architecture.md](architecture.md#a-new-weapon-behavior): adding a weapon
