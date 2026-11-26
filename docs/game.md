# The game

ALTER is a top-down, real-time 2D mass battle game that runs in the browser. Every unit is an ALTER (Adaptive Limbframe for Tactical Engagement and Reconnaissance), a piloted combat frame. The player flies one ace ALTER. Exact values are in [reference.md](reference.md).

## Overview

| | |
| --- | --- |
| Player unit | One ace ALTER |
| Allied army | 100 units, deployed in the west. No reinforcements |
| Enemy army | 300–600 units (set in the hangar, steps of 50), deployed in the east. Units beyond the first 240 arrive as reinforcements |
| Battlefield | 6000 × 3400 world units, divided into sectors A1–F4 |
| Firing | Automatic. The ace fires its active weapon at the target picked by the current aim mode, inside that weapon's range |
| Player decisions | Movement, active hardpoint, aim mode, dash, tools, super release |
| Win | No enemy units left on the field or in reserve |
| Loss | The ace is destroyed |
| Audio | None |

## Sortie flow

1. **Hangar.** The player picks a frame, fills four hardpoints, picks an aim mode and sets the enemy army size. An AI-only skirmish (110 allies, 140 enemies) runs behind the menu. The loadout is saved in the browser.
2. **Deployment.**
   - **Allies:** 100 units in three groups on the west side.
   - **Enemies:** up to 240 units in four groups on the east side. The rest are held in reserve.
   - **The ace:** starts just ahead of the allied line.
3. **Battle.**
   - **Reinforcements:** a battalion of 60 enters from the east edge every 25 s, or as soon as fewer than 150 enemies remain on the field, while reserves remain.
   - **Banners:** a center-screen message marks reinforcements, an enemy semi-ace and its pack starting to hunt the ace, an enemy Commander or semi-ace destroyed, half the allies lost, all allies lost, the final reserves deployed, and the ace's HP falling below 25%.
   - **Praise banners:** every 100 ace kills, 25 kills within 4 s, and a super release that downs 10 or more. A praise banner never replaces another banner still on show.
4. **End.** Victory when no enemy is left on the field or in reserve. Defeat when the ace is destroyed. Losing every ally does not end the sortie.
5. **Result.** Rating and rank with their factors and the best rating for this army size (victories only), battle time, kills, enemies left, allies alive, damage taken, close dodges, kills per weapon, and medals earned. Weapon kills count toward medals in won and lost sorties.

Every deployment comes from a seed. The same seed gives the same starting battle (`?seed=N` in the URL).

## Rating and rank

A won sortie is rated. A lost sortie has no rating.

```
rating = 10 × enemy army size × pace × integrity × allied line
```

| Factor | Value |
| --- | --- |
| Pace | Par time (0.55 s per enemy) ÷ clear time, between ×0.5 and ×1.5 |
| Integrity | 1 − 0.08 per max HP of damage taken, at least ×0.5 |
| Allied line | 1 + 0.3 × the share of allies alive |

The rank letter comes from the rating per enemy (rating ÷ army size):

| Rank | Rating per enemy |
| --- | --- |
| S | 10.5 or more |
| A | 8.5 or more |
| B | 6.5 or more |
| C | Less than 6.5 |

The browser keeps the best rating for each army size. The result card shows it, or marks a new best.

## Weapon medals

Kills with each weapon add up over every sortie (stored in the browser). A weapon earns Bronze at 100 kills, Silver at 500 and Gold at 2000. Weapon cards in the hangar show the medal, career kills and the next medal; the result card lists medals earned in that sortie.

## Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W A S D, arrow keys | Drag anywhere on the field (a joystick appears under the finger) | Thrust. The ace has inertia (see [mechanics.md](mechanics.md#movement)) |
| 1–4 | Tap a hardpoint | Make that weapon active, or fire that tool |
| Q / E | Aim button | Cycle the aim mode |
| 5, 6, 7, 8, 9, 0 | Tap a mode in the aim grid | Select an aim mode directly |
| Shift | Dash button | Dash in the steering direction (or the facing direction with no input). Brief invulnerability |
| Space | Release button | Super release, when the gauge is full |
| R | – | Reload the active weapon |
| + / −, mouse wheel | – | Zoom |
| P, Esc | Pause button | Pause |

Weapons do not fire during a Beam Saber lunge, nor during a dash except the Assault Rifle.

## Hangar

| Element | Contents |
| --- | --- |
| Frame | Swift, Quickdraw or Vanguard ([weapons.md](weapons.md#frames)) |
| Aim mode | One of six ([weapons.md](weapons.md#aim-modes)). Can be changed during battle |
| Enemy army | Slider, 300–600. The legend below it lists every unit class with its shape, weapon, armor and traits |
| Hardpoints | Four. All four must be filled, and at least one must hold a weapon. Each weapon card shows its damage type, its strong and weak armor matchups, its medal and career kills. Each tool card shows its super release effect |
| Launch sortie | Starts the battle and saves the loadout |

## HUD

| Position | Contents |
| --- | --- |
| Top left | **Hostile:** enemies left in the whole army, and how many are in reserve. **Friendly:** allies alive, and the line state: holding, breaking (under 40 left) or fallen |
| Top center | Battle clock and the ace's kill count |
| Top right | Minimap and pause button |
| Center | Banners |
| Bottom left | Frame name, HP bar (red when critical), Dash chip with its recharge countdown, Release chip, and chips for running statuses (Overboost, Repair) |
| Bottom center | The four hardpoints. A weapon shows its ammo, "Reloading" with a progress bar, or ∞. A tool shows "Ready" or its recharge. The active weapon is highlighted. A tool pressed while recharging shakes |
| Bottom right | Aim mode grid with number keys, and touch buttons for aim, Release and Dash |

The Release chip fills with the super release gauge ("Release 62%"). When full it reads "Release ready · Space", with the number of enemies within the close-kill radius (320) when there are any. During a release it counts down ("Releasing 2.1").

## Visual legend

### Colors

| Color | Meaning |
| --- | --- |
| Warm white | The ace |
| Blue | Allied units and their fire |
| Orange-red | Enemy units and their fire |
| Magenta, with a thin halo | Enemy semi-aces and their fire |
| Small pip on an enemy unit | Member of a semi-ace's pack |
| Faint ring on the ground | A Commander's aura |
| Ring expanding from a Healer | A heal pulse |
| Ring around the ace, building up clockwise | The super release gauge filling. The ring marks the close-kill radius (320) |
| Pulsing ring around the ace | Super release is ready. A wave and a **RELEASE READY** callout mark the moment it fills, and the Release chip flashes |

### Shapes

Each unit class has its own outline: a square for the Trooper, a diamond for the Striker, a hollow block for the Bulwark, a hexagon for the Prism, a cross for the Healer, a star for the Circus, and so on. The full list is in [units.md](units.md#classes) and in the hangar legend.

### Hit markers

Only the ace's hits show markers.

| Marker | Condition |
| --- | --- |
| **CRITICAL**: a burst, labeled in the damage type's color | The target's armor multiplier for the damage type is above 1 |
| **RESIST**: a dull ring, gray label | The armor multiplier is below 1 |
| **SHIELD**: white label | A semi-ace's shield blocked the hit |
| **EXPOSED**: a burst, gold label | The target is exposed by a Plasma Mortar stun (×1.5) |

A unit shows at most one label every 0.45 s.

### Warnings

| Sign | Meaning |
| --- | --- |
| Faint dotted line from a Sentinel to its target | The Sentinel is charging its beam lance |
| Faint dotted line over a faint band from an enemy Commander | The Commander is charging its mega-beam. The band is the area it will hit |
| The line turns brighter, its dashes running toward the target | The aim is locked. A lance fires 0.35 s later, a mega-beam 0.45 s later |
| Solid beam | The discharge. A mega-beam is a thick beam with a white-hot core and a starburst at the muzzle |
| Missiles leaving backwards or wide | A salvo that turns and homes in after launch. A Circus swarm weaves as it flies |
| Bubble around a semi-ace | Its shield is up. The bubble flickers before it drops |
| Ground marker ahead of a target | Where the ace's Plasma Mortar shell will land |
| Pulsing gold corner brackets on an enemy | Exposed by a Plasma Mortar stun: hits from your side deal ×1.5 |
| Small **!** badge on the screen edge, with a pointer | A threat outside the view, in the pointer's direction: a unit charging a lance at the ace (orange; red and blinking once locked) or a stalking enemy semi-ace (magenta) |

### Callouts

| Callout | Meaning |
| --- | --- |
| **DODGE** over the ace | A close dodge ([mechanics.md](mechanics.md#close-dodge)) |
| **×N** over the ace | A super release that downed N enemies, as it ends |
| **RELEASE READY** over the ace | The super release gauge just filled |
| **CLASH** between the ace and an enemy | Saber met saber: both bounced apart, neither cut |

### Impacts

Every hit on the ace makes it jolt and blink red, then dark, pops a red ring off it, reddens the screen edges and shakes the view, all scaled by the damage. The HP bar shudders, and the HP just lost stays as a red segment before it drains.

Big moments land with a brief hit-stop (the battle holds while effects keep playing), a screen shake and a screen flash (a light frame, then a dark one). They mark the ace destroying a Commander or semi-ace, a heavy hit on the ace (red flash), super release starting, a close dodge, and the ace's destruction (followed by slow motion). Big blasts and mega-beams near the ace shake the screen. A unit judders when one of the ace's hits deals 60 or more. A Beam Saber lunge stretches the ace along its path, leaving afterimages; its slash sweeps open as a glowing blade trail, and a slash that connects lands with a brief hit-stop. Big units explode in stages: a flash, fire, then smoke. With the system setting for reduced motion, shake and flashes are weaker. Values: [reference.md](reference.md#battle-rules).

## Related

- [weapons.md](weapons.md): the ace's frames, weapons, tools and aim modes
- [units.md](units.md): unit classes, AI behavior and deployment
- [mechanics.md](mechanics.md): the rules in detail
- [glossary.md](glossary.md): terms
