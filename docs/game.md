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
4. **End.** Victory when no enemy is left on the field or in reserve. Defeat when the ace is destroyed. Losing every ally does not end the sortie.
5. **Result.** Rank (victories only), battle time, kills, enemies left, allies alive, damage taken, and kills per weapon.

Every deployment comes from a seed. The same seed gives the same starting battle (`?seed=N` in the URL).

## Ranks

The rank is the share of the **whole** enemy army, reserves included, destroyed by the ace's own weapons. Kills by allied units do not count. A lost sortie has no rank.

| Rank | Share destroyed by the ace |
| --- | --- |
| S | 60% or more |
| A | 45% or more |
| B | 30% or more |
| C | Less than 30% |

## Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W A S D, arrow keys | Drag anywhere on the field (a joystick appears under the finger) | Thrust. The ace has inertia (see [mechanics.md](mechanics.md#movement)) |
| 1–4 | Tap a hardpoint | Make that weapon active, or fire that tool |
| Q / E | Aim button | Cycle the aim mode |
| 5, 6, 7, 8, 9, 0 | Tap a mode in the aim grid | Select an aim mode directly |
| Shift | Dash button | Dash in the steering direction (or the facing direction with no input). Brief invulnerability |
| Space | Release button | Super release |
| R | – | Reload the active weapon |
| + / −, mouse wheel | – | Zoom |
| P, Esc | Pause button | Pause |

Weapons do not fire during a dash or a Beam Saber lunge.

## Hangar

| Element | Contents |
| --- | --- |
| Frame | Swift, Quickdraw or Vanguard ([weapons.md](weapons.md#frames)) |
| Aim mode | One of six ([weapons.md](weapons.md#aim-modes)). Can be changed during battle |
| Enemy army | Slider, 300–600. The legend below it lists every unit class with its shape, weapon, armor and traits |
| Hardpoints | Four. All four must be filled, and at least one must hold a weapon. Each weapon card shows its damage type and its strong and weak armor matchups |
| Launch sortie | Starts the battle and saves the loadout |

## HUD

| Position | Contents |
| --- | --- |
| Top left | **Hostile:** enemies left in the whole army, and how many are in reserve. **Friendly:** allies alive, and the line state: holding, breaking (under 40 left) or fallen |
| Top center | Battle clock and the ace's kill count |
| Top right | Minimap and pause button |
| Center | Banners |
| Bottom left | Frame name, HP bar (red when critical), Dash and Release chips with recharge countdowns, and chips for running statuses (Overboost, Repair, Super release) |
| Bottom center | The four hardpoints. A weapon shows its ammo, "Reloading" with a progress bar, or ∞. A tool shows "Ready" or its recharge. The active weapon is highlighted. A tool pressed while recharging shakes |
| Bottom right | Aim mode grid with number keys, and touch buttons for aim, Release and Dash |

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

### Shapes

Each unit class has its own outline: a square for the Trooper, a diamond for the Striker, a hollow block for the Bulwark, a hexagon for the Prism, a star for the Circus, and so on. The full list is in [units.md](units.md#classes) and in the hangar legend.

### Hit markers

Only the ace's hits show markers.

| Marker | Condition |
| --- | --- |
| **CRITICAL**: a burst, labeled in the damage type's color | The target's armor multiplier for the damage type is above 1 |
| **RESIST**: a dull ring, gray label | The armor multiplier is below 1 |
| **SHIELD**: white label | A semi-ace's shield blocked the hit |

A unit shows at most one label every 0.45 s.

### Warnings

| Sign | Meaning |
| --- | --- |
| Thin line from a Sentinel to its target | The Sentinel is charging its beam lance |
| The line turns bright and dashed | The lance's aim is locked. It fires 0.35 s later and hits everything on the line |
| Missiles leaving backwards or wide | A salvo that turns and homes in after launch. A Circus swarm weaves as it flies |
| Bubble around a semi-ace | Its shield is up. The bubble flickers before it drops |
| Ground marker ahead of a target | Where the ace's Plasma Mortar shell will land |

## Related

- [weapons.md](weapons.md): the ace's frames, weapons, tools and aim modes
- [units.md](units.md): unit classes, AI behavior and deployment
- [mechanics.md](mechanics.md): the rules in detail
- [glossary.md](glossary.md): terms
