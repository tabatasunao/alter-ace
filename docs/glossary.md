# Glossary

Terms used in the game, the code and these docs. Code names are in `code font`.

| Term | Meaning |
| --- | --- |
| **Ace** | The player's unit. Code: `Player` (`kind: 'player'`) |
| **`aceDamageTaken`** | Global scale on damage the ace takes (0.5) |
| **`aceFirst`** | The Marksman's and Circus's targeting: the ace whenever it is within the weapon's range, otherwise the nearest hostile. Circus missiles switch to the ace within 160 |
| **`aceHitMul`** | A class's multiplier on damage from the ace and semi-aces. 1.5 for normal ALTERs |
| **`aceHuntRange`** | Distance (800) within which hunters target the ace and a Duelist starts stalking it |
| **Aim mode** | The rule that picks the ace's target: Closest, Furthest, Lowest HP, Strongest, Densest pack, Attacking me. Code: `AimStrategy` |
| **ALTER** | Adaptive Limbframe for Tactical Engagement and Reconnaissance: the piloted combat frame every unit is |
| **Armor** | A unit class's defense table: Standard, Heavy plate, Beam coating, Reactive armor. Scales hits by damage type |
| **Arsenal** | The 6 weapons available for hardpoints, grouped by damage type |
| **Near miss, graze** | Enemy fire that passes within 36 of the ace's hull without touching it; it charges the Full Arms gauge (`src/sim/graze.ts`, `GrazeSystem`) |
| **Trait** | What a damage type's weapons do best: Kinetic fires fastest, Beam reaches farthest, Blast homes (`damage.json` → `trait`) |
| **Sight line (Sniper Rifle)** | The beam-colored line from the ace to the Sniper Rifle's target for the last 0.45 s before each shot |
| **Aura** | A Commander's radius (230) in which its army fires 30% faster. Enemy units it boosts glow magenta, as does the enemy Commander |
| **Allied line (factor)** | A rating factor: 1 + 0.3 × the share of allies alive |
| **Banner** | A center-screen battle message. Praise banners are minor: they never replace another banner on show |
| **Battalion** | A group of 60 enemy reinforcements |
| **Behavior** | The `behavior` field that selects a weapon's firing code from a registry (`bullet`, `beam`, `missile`…) |
| **Bench** | The weapon benchmark in `tests/balance/weaponBench.ts`: a bot pilot flies one weapon against an enemy formation. Used by `tests/balance.test.ts` |
| **Burst, opening burst** | The start of Full Arms: every weapon launches 7.5 s worth of fire at once in random directions |
| **`burstArc`** | A weapon's spray arc for the burst, in degrees (60 for the Railgun and Sniper Rifle; 360 by default) |
| **Catalog** | Read-only lookup over the loaded data (`src/data/catalog.ts`) |
| **Callout** | A short word over the ace: DODGE, FULL ARMS READY, CLASH, or ×N as Full Arms ends. Shown in the current language |
| **Key map** | The current key bindings as key → action lookups and key labels (`KeyMap`, `src/input/keymap.ts`), built from the settings |
| **Career** | Best rating and furthest share of the army destroyed per army size, and kills per weapon, over every sortie, stored in the browser (`src/game/career.ts`) |
| **Centroid** | The average position of an army. Units with no target march toward the opposing one |
| **CRITICAL** | Marker on an ace hit whose armor multiplier is above 1 |
| **Clash** | The ace's saber meeting an enemy saber: neither cuts, and both bounce apart |
| **Close-quarters fire** | Enemy fire at the ace within 400: more lead, tighter spread and up to twice the fire rate, rising to full at point blank (`ai.closeAim`) |
| **Close dodge** | A hostile attack touching the ace during a dash's invulnerability. Once per dash: dash refunded, Full Arms gauge +15% |
| **Close-kill radius** | 320 around the ace. Ace kills inside it charge the Full Arms gauge 2.5 times as much |
| **Damage rule** | One step applied to a hit (`DAMAGE_RULES` in `src/sim/damageRules.ts`): shield, army softening, ace vulnerability, armor, stagger; for the ace, scale, record, heavy-hit impact |
| **Damage type** | Kinetic, Beam or Blast. Each weapon has one |
| **Dash** | Shift: a short, fast move with brief invulnerability |
| **Dash strike** | The Duelist's long attack: it stands while an aim line tracks its target and locks, then dashes along the line and slashes at its end |
| **Demo, hangar skirmish** | The AI-only battle behind the hangar (`demoPipeline()`) |
| **Effect** | A short-lived visual (debris, blast, hit marker, slash) in `world.fx`. No gameplay effect |
| **Exposed** | An enemy stunned by a `mortar` shell: hits from the ace's side deal × `exposedMul` while the stun lasts. Marked EXPOSED and with gold corner brackets |
| **Filler class** | The class that fills what an army's shares leave: the Trooper |
| **Frame** | The ace's machine, built from points over five stats (speed, HP, reload, fire rate, dash) and named by the player |
| **Frame build, preset** | Points per frame stat (`FrameBuild`); a preset is a named build in frames.json |
| **Full Arms** | Space with a full gauge: an opening burst from every weapon, then for 3 s every weapon hardpoint fires, with damage taken halved (in code, `superRelease` and `release`) |
| **Full Arms gauge** | The Full Arms charge, 0–1. Half full at sortie start; refilled by kills, close dodges and time |
| **Hardpoint, slot** | One of the ace's four loadout positions, each holding a weapon |
| **Healer** | A support class in both armies. Its heal pulse restores 15% of max HP to its army within 220 every 10 s (allied: the ace too) |
| **Heavy beam** | The mega-beam's discharge look: glow layers around a white-hot core, with a muzzle flare (`look: "heavyBeam"`) |
| **Hit reaction** | What every hit on the ace does: a jolt, a red ring, red screen edges and a shake, scaled by damage |
| **Hit-stop, freeze** | A moment when the simulation holds while effects keep playing (`world.impact.freeze`) |
| **Hit** | One instance of damage: source, weapon id, damage type, semi-ace flag (`Hit` in `src/sim/entities.ts`) |
| **Hit marker** | The CRITICAL, RESIST or SHIELD flash and label on an ace hit |
| **Hunter** | An enemy unit that targets the ace within 800: every Lancer, Sentinel, Hornet, Duelist and Commander, plus 35% of the rest (`aceAggro`) |
| **Impact** | Hit-stop, shake and flash for a big moment (`src/sim/impact.ts`, `battle.json` → `impact`) |
| **Integrity** | A rating factor: 1 − 0.08 per max HP of damage taken, at least 0.5 |
| **i-frames** | Invulnerability frames: time during which the ace cannot be hit |
| **Knockback** | A unit thrown back and sliding to a stop, its action lost (`knockBack`) |
| **Kiting** | Backing away to keep a target at range. AI classes with `kiteDistance` do this |
| **Lance** | A charged beam: a tracking sight line that locks, then strikes the whole line. The Sentinel's beam lance and the enemy Commander's mega-beam |
| **Language, locale** | The language of all game text: English (`en`), Japanese (`ja`), Simplified Chinese (`zh`) or Korean (`ko`), picked at the top right of the hangar. Proper nouns stay in English. Code: `Locale` (`src/i18n`) |
| **Launch sequence** | The overlay at the start of a sortie: the ALTER's name, frame stats and weapons, then LAUNCH, when the ace boosts off. Any key skips it (`LaunchView`, `launchAce`) |
| **Lead** | Aiming ahead of a moving target. AI weapons use a fraction (`lead`) of the exact intercept |
| **Leash** | A maximum distance a unit keeps: a stalking Duelist to the ace (`nearAce`), a pack member to its leader (`rally.follow`), a Marksman or Circus to its front line (`holdLine`) |
| **Front line** | Where an army meets its enemy, judged per unit in any direction: a unit's depth is its distance to its nearest hostile minus the nearest teammate's. The Marksman holds behind it, the Circus on it (`holdLine`) |
| **Loadout** | Frame, four hardpoints, aim mode and enemy count, chosen in the hangar and saved in the browser |
| **Message** | Text from the simulation as a translation key and parameters, rendered in the current language by the UI (`Message`, `msg()`, `tm()`) |
| **Medal** | Bronze, Silver or Gold for 100, 500 or 2000 career kills with one weapon |
| **Mega-beam** | The enemy Commander's weapon: a charged lance, 100 damage, hits within 28 of its line |
| **Normal ALTER** | Trooper and Beam Trooper: about half of each army, taking ×1.5 damage from the ace and semi-aces |
| **Pack** | The 10–20 enemy units a stalking Duelist rallies. Disbands when the Duelist dies |
| **Options** | Screen shake, screen flash, HUD size and key bindings, saved in the browser (`src/game/settings.ts`, `OptionsView`) |
| **Pace** | A rating factor: par time ÷ clear time, 0.5–1.5 |
| **Painter** | A function that draws one kind of unit, shot or effect, chosen from a registry |
| **Pipeline** | The ordered list of systems a simulation step runs (`src/sim/pipelines.ts`) |
| **Projectile, shot** | Anything in flight: bullets, beams, shells, missiles, mortar rounds (`world.shots`) |
| **Rally** | A stalking Duelist gathering its pack (`rally` in `units.json`) |
| **Rank** | A class's priority for the Strongest aim mode; or the end-of-sortie letter (S, A, B, C) from the rating per enemy |
| **Rating** | A won sortie's score: 10 × army size × pace × integrity × allied line |
| **Registry** | A table from a data name to its implementation. Most are typed so that a missing entry fails compilation |
| **Reinforcements, reserve** | Enemies beyond the first 240, sent in battalions |
| **RESIST** | Marker on an ace hit whose armor multiplier is below 1 |
| **Reticle** | The ace's current target, re-picked every 0.12 s |
| **Sector** | A labeled square of the battlefield grid, A1 to F4 |
| **Seed** | The number that fixes a battle's random draws. `?seed=N` |
| **Semi-ace** | An enemy unit class (Marksman, Circus, Duelist) with a shield and the `aceHitMul` bonus. Drawn in magenta. Enemy army only |
| **Shield** | A semi-ace's bubble: raised by the first hit, blocks every hit for 1.5 s, recharges in 10 s |
| **SHIELD** | Marker on an ace hit that a shield blocked |
| **Sight line** | The line drawn by a charging unit action (the Sentinel's lance) |
| **Slow motion** | After the ace's destruction, the battle runs at ×0.3 speed for 1.2 s |
| **Slug** | The Railgun's shot as drawn: a dart racing down the line and the wake it leaves. The hit itself is instant (`SlugEffect`) |
| **Soldier** | Code name for an AI unit (`kind: 'soldier'`, `SoldierAISystem`) |
| **Sortie** | One battle, from launch to result |
| **Steady aim** | The Railgun's damage, lowest at top speed and highest at rest, with a 20% bonus under 10% of top speed (full strength). Shown by the reticle's brackets and an arc above the ace |
| **Stagger** | A unit's brief judder after one of the ace's hits of 60 or more (visual only) |
| **Stalking** | State of a Duelist (and its pack) that has found the ace and targets it at any distance |
| **Status** | A timed effect on the ace: Full Arms (`src/sim/statuses.ts`) |
| **Strategy** | An interchangeable implementation selected by name: weapon behavior, aim mode, painter, movement model… |
| **Stun** | Unit stopped, current action canceled, shield dropped (from a `mortar` shell) |
| **System** | One job in the simulation step (`System` interface), such as `SoldierAISystem` |
| **Terminal correction** | A Circus missile's one hard turn when it first comes within 260 of its target, toward where the target is heading; it then flies straight on (`terminal`) |
| **Turn (charged attack)** | Permission to charge a lance or wind up a dash strike at the ace. At most 2 at once, their shots at least 0.6 s apart (`ai.aceCharges`) |
| **Threat marker** | A small "!" badge on the screen edge, pointing toward an off-screen unit charging a lance or winding up a dash strike at the ace, or a stalking Duelist |
| **Tone** | A semantic color name on a unit or effect (`ally`, `enemy`, `semiAce`, `accent`…) that the palette maps to CSS tokens |
| **Tutorial mission** | A short mission that teaches the controls one stage at a time (`armies.json` → `tutorial`, `src/sim/systems/TutorialSystem.ts`) |
| **Unit action** | Something an AI unit does over time, one at a time: a lance charge, a dash strike wind-up, a saber lunge or a hop back (`UnitAction`) |
| **Unit weapon** | An AI class's weapon (`unitWeapons.json`), with behaviors `shot`, `missile`, `lance`, `saber` |
| **`unitVsUnit`** | Scale on damage between AI units (0.15) |
| **World** | All battle state: units, shots, effects, stats, camera, grid (`src/sim/World.ts`) |

## Related

- [README.md](README.md): documentation index
- [mechanics.md](mechanics.md): the rules behind these terms
