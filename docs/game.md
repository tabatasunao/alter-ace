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
| Player decisions | Movement, active hardpoint, aim mode, dash, Full Arms |
| Win | No enemy units left on the field or in reserve |
| Loss | The ace is destroyed |
| Audio | Sound effects and music, CC0 ([sources](../public/licenses/AUDIO.md)). Volumes in [Options](#options) |
| Languages | English, Japanese, Simplified Chinese, Korean, picked at the top right of the hangar. Weapon, unit class and preset names, Full Arms, semi-ace and the launch sequence stay in English in every language |

## Sortie flow

1. **Hangar.** The player picks a frame, fills four hardpoints, picks an aim mode and sets the enemy army size. An AI-only skirmish (110 allies, 140 enemies) runs behind the menu. The loadout is saved in the browser.
2. **Deployment.**
   - **Allies:** 100 units in three groups on the west side.
   - **Enemies:** up to 240 units in four groups on the east side. The rest are held in reserve.
   - **The ace:** starts just ahead of the allied line.
3. **Launch.** The battle holds with the camera close on the ace. Letterbox bars close in, a link line types out, the ALTER's name assembles letter by letter, then its frame stats and weapons appear. At **LAUNCH** (1.7 s) the battle starts and the ace boosts forward at 1.4× its top speed, with afterimages and a screen shake, while the camera pulls back. The overlay clears and the HUD appears at 2.55 s. Any key or a click skips to the launch. The overlay is in English in every language.
4. **Battle.**
   - **Reinforcements:** a battalion of 60 enters from the east edge every 25 s, or as soon as fewer than 150 enemies remain on the field, while reserves remain.
   - **Banners:** a center-screen message marks reinforcements, an enemy Duelist and its pack starting to hunt the ace, an enemy Commander or semi-ace destroyed, half the allies lost, all allies lost, the final reserves deployed, and the ace's HP falling below 25%.
   - **Praise banners:** every 100 ace kills, 25 kills within 4 s, and Full Arms downing 10 or more. A praise banner never replaces another banner still on show.
5. **End.** Victory when no enemy is left on the field or in reserve. Defeat when the ace is destroyed. Losing every ally does not end the sortie.
6. **Result.** After 1.6 s, or at once on any key.
   - **Victory:** rating and rank with their factors, the best rating for this army size, and the score the next rank takes at this army size.
   - **Defeat:** titled with the ALTER's name ("<name> was destroyed"), the share of the army destroyed on a bar, marked with the furthest share for this army size, and one tip. The tip is the first that applies: Full Arms was ready when the ace went down; no close dodge; otherwise, weapon and armor matchups.
   - **Both:** battle time, kills, enemies left, allies alive, damage taken, close dodges, kills per weapon with each weapon's progress to its next medal, and medals earned. Weapon kills count toward medals in won and lost sorties.

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

Default keys. Every key action can be rebound in [Options](#options).

| Keyboard | Touch | Action |
| --- | --- | --- |
| W A S D, arrow keys | Drag anywhere on the field (a joystick appears under the finger) | Thrust. The ace has inertia (see [mechanics.md](mechanics.md#movement)) |
| 1–4 | Tap a hardpoint | Make that weapon active |
| Q / E | Aim button | Cycle the aim mode |
| 5, 6, 7, 8, 9, 0 | Tap a mode in the aim grid | Select an aim mode directly. A number key bound to an action does that action instead |
| Shift | Dash button | Dash in the steering direction (or the facing direction with no input). Brief invulnerability |
| Space | Full Arms button | Full Arms, when the gauge is full |
| R | – | Reload the active weapon |
| + / −, mouse wheel | – | Zoom (0.3–1.6). While the Sniper Rifle is active the camera zooms out further, to ×0.7 of the chosen zoom, and returns when another weapon is selected |
| P, Esc | Pause button | Pause |

Weapons do not fire during a Beam Saber lunge or a dash.

| Screen | Key | Action |
| --- | --- | --- |
| Hangar | Enter, Space | Launch sortie (when no button or field has focus) |
| Launch sequence | Any key, click | Skip to the launch |
| Sortie over, before the result card | Any key | Show the result card now |
| Result card | Space, Enter or any other key | Sortie again. Ignored for the first 0.45 s of the card |
| Result card | Esc | Back to the hangar |

## Hangar

| Element | Contents |
| --- | --- |
| Language | Top right: English, 日本語, 简体中文, 한국어, each in its own script. Switches all game text at once and is saved in the browser. Until a language is picked, the browser's language is used if it is one of these, otherwise English |
| Frame | The ALTER's name (up to 16 characters; empty falls back to ALTER), and 25 points to spend over speed, HP, reload, fire rate and dash, up to 10 on each: − and + on each stat, or a click on its segments (a click on the top filled segment takes that point back). Presets (Swift, Quickdraw, Vanguard) fill in a whole build. Unspent points show in the launch bar ([weapons.md](weapons.md#frames)) |
| Aim mode | One of six ([weapons.md](weapons.md#aim-modes)). Can be changed during battle |
| Enemy army | Slider, 300–600. Below it: the best rating and rank against this army size (or, before a victory, the furthest share of it destroyed), and the enemy field guide, folded by default, listing every unit class with its shape, weapon, armor and traits |
| Hardpoints | Four, filled from 6 weapons; all four must be filled. The arsenal is grouped in rows by damage type, each labeled with its trait (Kinetic: fastest fire, Beam: longest reach, Blast: homing). On narrow screens it is one list. Picking a weapon puts it in the first empty hardpoint; picking an equipped weapon (or its hardpoint) empties that hardpoint, and the others keep their places and keys. Each card shows the weapon's damage type, its strong and weak armor matchups, its medal and career kills |
| Controls | The current key bindings in one strip, and what Full Arms does |
| Options | Opens [Options](#options) |
| Launch sortie | Starts the battle (Enter or Space too) and saves the loadout. Pressed while the loadout cannot launch, the button shakes, the reason flashes, and the empty hardpoints flash and scroll into view |

The hangar puts the hardpoints and arsenal in the wide left column, and the frame build, aim mode and enemy army in the right column, with the controls below. Section headers are numbered in that order: Hardpoints, Frame, Aim mode, Enemy army, Controls.

## Sound

Audio starts with the first click or key press (browsers block it before one). The hangar plays its own music; the battle music fades in at launch and fades out when the sortie ends, with a short sting after a victory. Pausing lowers the music, and hiding the tab silences everything.

The ace's weapons sound on every shot. Explosions, unit deaths, enemy beams and enemy fire sound by where they are: quieter and panned to the side away from the middle of the view, silent far beyond its edge. Allied fire is silent. A dash, Full Arms, hits on the ace, close dodges, saber clashes, banners and the launch sequence each have their own sound.

## Pause

The pause card lists the main keys and has **Resume**, **Restart sortie** (a new sortie with the same loadout), **Options** and **Abandon sortie** (back to the hangar). Switching to another tab or window pauses the sortie.

## Options

Options open from the hangar and from the pause card. Every change applies at once and is saved in the browser. **Reset to defaults** restores every setting on the card; the language is unchanged.

| Setting | Values | Effect |
| --- | --- | --- |
| Screen shake | 0–100%, steps of 10 | Scales every screen shake. A change plays a sample shake |
| Screen flash | 0–100%, steps of 10 | Scales screen flashes and the red screen edges when the ace is hit. A change plays a sample flash |
| Effects volume | 0–100%, steps of 10 (default 80%) | Weapons, explosions, warnings and the interface. A change plays a sample sound |
| Music volume | 0–100%, steps of 10 (default 60%) | Hangar and battle music |
| HUD size | Normal, Large (115%), Larger (130%) | Scales the whole HUD. A bigger HUD switches to its narrower layouts at wider screens |
| Keys | Up to two keys per action | Click a key, then press the new one. Esc cancels; Delete or Backspace clears it. A key does one thing: binding it takes it from its old action. Tab, F5, F11, F12 and the system keys cannot be bound |

The system setting for reduced motion scales shake and flash down further, to 30% of the chosen strength.

## HUD

| Position | Contents |
| --- | --- |
| Top left | **Hostile:** enemies left in the whole army, and how many are in reserve. **Friendly:** allies alive, and the line state: holding, breaking (under 40 left) or fallen |
| Top center | Battle clock and the ace's kill count |
| Top right | Minimap and pause button |
| Center | Banners |
| Bottom left | The ALTER's name, HP bar in ten segments (red when critical) with the HP readout, Dash chip, and Full Arms chip |
| Bottom center | The four hardpoints, each with its key. A weapon shows its ammo, "Reloading" with a progress bar, or ∞. The active weapon is highlighted |
| Bottom right | The current aim mode and its cycle keys. The grid of all modes opens for 2.2 s when the mode changes, and stays open after a click on the header. On narrow screens the grid becomes an aim button. On touch screens: Full Arms and Dash buttons |

Counters (enemies, allies, kills) are zero-padded to three digits, with the leading zeros dimmed.

The Dash chip shows its key when ready, otherwise its recharge countdown ("Dash 1.2"). The Full Arms chip fills with the Full Arms gauge ("Full Arms 62%"). When full it shows its key ("Full Arms ready · Space"), with the number of enemies within the close-kill radius (320) when there are any. While Full Arms runs it counts down the seconds left ("Full Arms 2.1"). On touch screens the chips leave out the key. Dash or Full Arms pressed before it is ready shakes its chip (and touch button) and flashes it red.

The HUD's breakpoints follow its own width, so the HUD size setting moves them: under 1240 px the hardpoints move to a second row; under 760 px the aim grid becomes an aim button; under 640 px the force panels compact and the clock hides.

## Visual legend

### Colors

| Color | Meaning |
| --- | --- |
| Warm white | The ace |
| Blue | Allied units and their fire |
| Orange-red | Enemy units and their fire |
| Magenta, with a thin halo | Enemy semi-aces and their fire |
| Small pip on an enemy unit | Member of a Duelist's pack |
| Faint ring on the ground | A Commander's aura |
| Magenta glow | An enemy Commander, and each enemy unit its aura is boosting. A unit's glow fades as it leaves the aura |
| Ring expanding from a Healer | A heal pulse |
| Gold | The ace's own markers: the target reticle, thrust, the active hardpoint and aim mode, ready chips |
| Lime yellow | Full Arms: the gauge ring, the Full Arms chip and button, the **FULL ARMS READY** and **×N** callouts, the ring around the ace while Full Arms runs, and, while it runs, the glow under the ace's shots (which turn white) and around its beams, slugs and slashes |
| Arc close around the ace | The ace's HP, while hurt. Red when critical |
| Short arc under the ace | The dash: fills as it recharges, gold when ready |
| Beam-colored sight line from the ace to its target, with a ring closing in (Sniper Rifle active) | The Sniper Rifle's next shot: it fires when the ring closes |
| Arc above the ace (Railgun active) | Steady aim: fills as the ace slows. White and thick at full strength |
| Ring around the ace, building up clockwise | The Full Arms gauge filling. The ring marks the close-kill radius (320) |
| Pulsing ring around the ace | Full Arms is ready. A wave and a **FULL ARMS READY** callout mark the moment it fills, and the Full Arms chip flashes |

### Shapes

Each unit class has its own outline: a square for the Trooper, a diamond for the Striker, a hollow block for the Bulwark, a hexagon for the Prism, a cross for the Healer, a star for the Circus, nested squares for an allied Commander and a pentagon for an enemy one, and so on. The full list is in [units.md](units.md#classes) and in the hangar legend.

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
| Faint dotted line from a Sentinel to its target | The Sentinel is charging its beam lance |
| Faint dotted line over a faint band from an enemy Commander | The Commander is charging its mega-beam. The band is the area it will hit |
| Dotted line from a Duelist standing still | A dash strike winding up. Once the line locks, the Duelist dashes along it 0.3 s later and slashes at its end, leaving a fading trail |
| The line turns brighter, its dashes running toward the target | The aim is locked. A lance fires 0.35 s later, a mega-beam 0.45 s later |
| Solid beam | The discharge. A mega-beam is a thick beam with a white-hot core and a starburst at the muzzle |
| Missiles leaving backwards or wide | A salvo that turns and homes in after launch. A Circus swarm weaves as it flies |
| Circus missile trails turning bright | The missile has made its last turn toward where its target is heading and now flies straight. Change course or dash to slip it |
| Bubble around a semi-ace | Its shield is up. The bubble flickers before it drops |
| A short two-tone chime | A charged attack (lance, mega-beam or dash strike) just locked onto the ace |
| Small **!** badge on the screen edge, with a pointer | A threat outside the view, in the pointer's direction: a unit charging a lance or winding up a dash strike at the ace (orange; red and blinking once locked) or a stalking Duelist (magenta) |

### Callouts

| Callout | Meaning |
| --- | --- |
| **DODGE** over the ace | A close dodge ([mechanics.md](mechanics.md#close-dodge)) |
| **×N** over the ace | Full Arms ending; N is how many enemies it downed |
| **FULL ARMS READY** over the ace | The Full Arms gauge just filled |
| **CLASH** between the ace and an enemy | Saber met saber: both bounced apart, neither cut |

### Impacts

Every hit on the ace makes it jolt and blink red, then dark, pops a red ring off it, reddens the screen edges and shakes the view, all scaled by the damage. The HP bar shudders, and the HP just lost stays as a red segment before it drains.

Big moments land with a brief hit-stop (the battle holds while effects keep playing), a screen shake and a screen flash (a light frame, then a dark one). They mark the ace destroying a Commander or semi-ace, a heavy hit on the ace (red flash), Full Arms starting, a full-strength Railgun hit (hit-stop and shake only), a close dodge, and the ace's destruction (followed by slow motion). Big blasts and mega-beams near the ace shake the screen, and each Shotgun shot gives it a short shake as the ace jolts back. During a Beam Saber lunge the camera zooms in slightly. A unit judders when one of the ace's hits deals 60 or more. A Beam Saber lunge stretches the ace along its path, leaving afterimages; its slash sweeps open as a glowing blade trail, and a slash that connects lands with a brief hit-stop. Big units explode in stages: a flash, fire, then smoke. Shake and flash strength follow [Options](#options), and the system setting for reduced motion lowers both. Values: [reference.md](reference.md#battle-rules).

## Related

- [weapons.md](weapons.md): the ace's frames, weapons and aim modes
- [units.md](units.md): unit classes, AI behavior and deployment
- [mechanics.md](mechanics.md): the rules in detail
- [glossary.md](glossary.md): terms
