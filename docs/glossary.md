# Glossary

Terms used in the game, the code and these docs. Code names are in `code font`.

| Term | Meaning |
| --- | --- |
| **Ace** | The player's unit. Code: `Player` (`kind: 'player'`) |
| **`aceDamageTaken`** | Global scale on damage the ace takes (0.5) |
| **`aceHitMul`** | A class's multiplier on damage from the ace and semi-aces. 1.5 for normal ALTERs |
| **`aceHuntRange`** | Distance (800) within which hunters target the ace and enemy semi-aces start stalking it |
| **Aim mode** | The rule that picks the ace's target: Closest, Furthest, Lowest HP, Strongest, Densest pack, Attacking me. Code: `AimStrategy` |
| **ALTER** | Adaptive Limbframe for Tactical Engagement and Reconnaissance: the piloted combat frame every unit is |
| **Armor** | A unit class's defense table: Standard, Heavy plate, Beam coating, Reactive armor. Scales hits by damage type |
| **Arsenal** | The 9 weapons and 4 tools available for hardpoints |
| **Aura** | A Commander's radius (230) in which its army fires 30% faster |
| **Banner** | A center-screen battle message |
| **Battalion** | A group of 60 enemy reinforcements |
| **Behavior** | The `behavior` field that selects a weapon's firing code from a registry (`bullet`, `beam`, `missile`…) |
| **Bench** | The weapon benchmark in `tests/balance/weaponBench.ts`: a bot pilot flies one weapon against an enemy formation. Used by `tests/balance.test.ts` |
| **Burst, opening burst** | The start of super release: every weapon launches 2.5 s worth of fire at once in random directions |
| **`burstArc`** | A weapon's spray arc for the burst, in degrees (60 for the Beam Rifle and Railgun; 360 by default) |
| **Catalog** | Read-only lookup over the loaded data (`src/data/catalog.ts`) |
| **Centroid** | The average position of an army. Units with no target march toward the opposing one |
| **CRITICAL** | Marker on an ace hit whose armor multiplier is above 1 |
| **Damage rule** | One step applied to a hit (`DAMAGE_RULES` in `src/sim/damageRules.ts`): shield, army softening, ace vulnerability, armor |
| **Damage type** | Kinetic, Beam or Blast. Each weapon has one |
| **Dash** | Shift: a short, fast move with brief invulnerability |
| **Decoy** | The Decoy Beacon's beacon, which enemy units nearby target. Code: `kind: 'decoy'` |
| **Demo, hangar skirmish** | The AI-only battle behind the hangar (`demoPipeline()`) |
| **Effect** | A short-lived visual (debris, blast, hit marker, slash) in `world.fx`. No gameplay effect |
| **EMP** | The EMP Burst tool: stuns enemies in a radius and deletes their shots |
| **Filler class** | The class that fills what an army's shares leave: the Trooper |
| **Frame** | The ace's machine: Swift, Quickdraw or Vanguard |
| **Hardpoint, slot** | One of the ace's four loadout positions, holding a weapon or a tool |
| **Hit** | One instance of damage: source, weapon id, damage type, semi-ace flag (`Hit` in `src/sim/entities.ts`) |
| **Hit marker** | The CRITICAL, RESIST or SHIELD flash and label on an ace hit |
| **Hunter** | An enemy unit that targets the ace within 800: every Lancer, Sentinel, Hornet, semi-ace and Commander, plus 35% of the rest (`aceAggro`) |
| **i-frames** | Invulnerability frames: time during which the ace cannot be hit |
| **Kiting** | Backing away to keep a target at range. AI classes with `kiteDistance` do this |
| **Lance** | The Sentinel's charged beam: a tracking sight line that locks, then strikes the whole line |
| **Lead** | Aiming ahead of a moving target. AI weapons use a fraction (`lead`) of the exact intercept |
| **Leash** | A maximum distance a unit keeps: a stalking semi-ace to the ace (`nearAce`), a pack member to its leader (`rally.follow`) |
| **Loadout** | Frame, four hardpoints, aim mode and enemy count, chosen in the hangar and saved in the browser |
| **Normal ALTER** | Trooper and Beam Trooper: about half of each army, taking ×1.5 damage from the ace and semi-aces |
| **Pack** | The 10–20 enemy units a stalking semi-ace rallies. Disbands when the semi-ace dies |
| **Painter** | A function that draws one kind of unit, shot or effect, chosen from a registry |
| **Pipeline** | The ordered list of systems a simulation step runs (`src/sim/pipelines.ts`) |
| **Projectile, shot** | Anything in flight: bullets, beams, shells, missiles, mortar rounds (`world.shots`) |
| **Rally** | A stalking semi-ace gathering its pack (`rally` in `units.json`) |
| **Rank** | A class's priority for the Strongest aim mode; or the end-of-sortie letter (S, A, B, C) |
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
| **Soldier** | Code name for an AI unit (`kind: 'soldier'`, `SoldierAISystem`) |
| **Sortie** | One battle, from launch to result |
| **Stalking** | State of an enemy semi-ace (and its pack) that has found the ace and targets it at any distance |
| **Status** | A timed effect on the ace: Overboost, Repair, Super release (`src/sim/statuses.ts`) |
| **Strategy** | An interchangeable implementation selected by name: weapon behavior, tool effect, aim mode, painter, movement model… |
| **Stun** | Unit stopped, current action canceled, shield dropped (from an EMP) |
| **Super release** | Space: an opening burst from every weapon, then every weapon hardpoint fires for 3 s. Recharges in 30 s |
| **System** | One job in the simulation step (`System` interface), such as `SoldierAISystem` |
| **Tone** | A semantic color name on a unit or effect (`ally`, `enemy`, `semiAce`, `accent`…) that the palette maps to CSS tokens |
| **Tool** | A hardpoint item that fires once and recharges: Repair Nanites, EMP Burst, Decoy Beacon, Overboost |
| **Unit action** | Something an AI unit does over time, one at a time: a lance charge or a saber lunge (`UnitAction`) |
| **Unit weapon** | An AI class's weapon (`unitWeapons.json`), with behaviors `shot`, `missile`, `lance`, `saber` |
| **`unitVsUnit`** | Scale on damage between AI units (0.15) |
| **World** | All battle state: units, shots, effects, stats, camera, grid (`src/sim/World.ts`) |

## Related

- [README.md](README.md): documentation index
- [mechanics.md](mechanics.md): the rules behind these terms
