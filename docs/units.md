# Units

AI units of both armies. Each class carries exactly one weapon, wears one armor and has its own outline. Stats and per-army counts are in [reference.md](reference.md#unit-classes).

## Classes

| Role | Class | Outline | Weapon | Type | Armor | Armies |
| --- | --- | --- | --- | --- | --- | --- |
| Line (normal ALTER) | Trooper | Square | Assault rifle | Kinetic | Standard | Both. Filler class |
| Line (normal ALTER) | Beam Trooper | Framed square | Beam rifle | Beam | Standard | Both |
| Skirmisher | Striker | Diamond | Beam pistol | Beam | Standard | Both |
| Heavy | Bulwark | Hollow block | Heavy cannon | Kinetic | Heavy plate | Both |
| Artillery | Lancer | Square with barrel | Artillery | Blast | Standard | Both |
| Sniper | Sentinel | Scope ring | Beam lance | Beam | Standard | Both |
| Missile carrier | Hornet | Twin pods | Missile rack | Blast | Standard | Both |
| Beam gunner | Prism | Hexagon | Beam cannon | Beam | Beam coating | Enemy |
| Shock trooper | Breacher | Chevron | Scattergun | Kinetic | Reactive armor | Enemy |
| Semi-ace | Marksman | Spear | Long beam rifle | Beam | Standard | Enemy |
| Semi-ace | Circus | Star | Micro-missile swarm | Blast | Heavy plate | Enemy |
| Semi-ace | Duelist | Blade | Beam saber | Beam | Beam coating | Enemy |
| Support | Healer | Cross | Beam pistol | Beam | Standard | Both |
| Leader | Commander | Nested squares | Beam repeater (enemy: Mega-beam) | Beam | Standard | Both. At least 2 per army |

Allied units are blue, enemy units orange-red, enemy semi-aces magenta with a thin halo.

### Trooper and Beam Trooper

The normal ALTERs: about half of each army. 75 HP, standard armor. Both take ×1.5 damage from the ace and from semi-aces (`aceHitMul`); damage from other units is unchanged.

- **Trooper:** assault rifle. Slow kinetic rounds with little lead.
- **Beam Trooper:** beam rifle. Fast beam bolts.

### Striker

42 HP, speed 165. Rapid, short-range beam pistol (range 270).

### Bulwark

320 HP, speed 55, heavy plate. Heavy kinetic cannon. Deploys at the front of the formation.

### Lancer

Long-range artillery (range 600) with splash. Always hunts the ace. Backs away from targets closer than 330.

### Sentinel

Beam lance, range 840, 10 s between shots.

1. **Charge (1.2 s):** a thin sight line tracks the target.
2. **Lock (last 0.35 s of the charge):** the line freezes, bright and dashed.
3. **Fire:** the beam hits every hostile unit on the line instantly.

Always hunts the ace. Backs away from targets closer than 400. A stun cancels the charge.

### Hornet

Fires pairs of homing missiles with splash, range 720, 9 s between salvos. Always hunts the ace. Backs away from targets closer than 330.

### Prism

Enemy only. 120 HP, beam coating (Beam ×0.5, Blast ×1.5). Beam cannon, range 460.

### Breacher

Enemy only. 150 HP, speed 125, reactive armor (Kinetic ×1.5, Blast ×0.5). Four-pellet scattergun, range 200.

### Semi-aces: Marksman, Circus, Duelist

Enemy only. 520–600 HP, faster than the line units.

| Semi-ace | Weapon | Armor |
| --- | --- | --- |
| Marksman | Long beam rifle, range 760, pierces 2. Backs away inside 380 | Standard |
| Circus | Salvos of 16 micro-missiles launched backwards, weaving as they home. Backs away inside 330 | Heavy plate |
| Duelist | Beam saber: closes, lunges, then slashes an arc. Clashes with the ace's Beam Saber ([weapons.md](weapons.md#beam-saber)) | Beam coating |

Shared traits:

- **Hits:** count as the ace's for `aceHitMul`, so they deal ×1.5 to normal ALTERs.
- **Strongest aim mode:** ranked just below the Commander.
- **Hunting:** always hunt the ace, and stalk it once found ([Stalking and packs](#stalking-and-packs)).
- **Shield:**
  1. The first hit once the shield is recharged raises it. That hit is blocked.
  2. For 1.5 s every hit is blocked (SHIELD marker). A bubble shows it and flickers before it drops.
  3. It recharges for 10 s, counted from when it rose.
  4. A stun drops a raised shield and prevents it rising.
- **Death:** an enemy semi-ace's death shows a banner.

### Healer

110 HP. Beam pistol, range 270. **Heal pulse:** every 10 s, a shockwave (an expanding ring) heals every unit of its army within 220 by 15% of that unit's max HP, up to full. Allied Healers also heal the ace. A stunned Healer's timer pauses.

### Commander

900 HP. **Weapon:** allied Commanders carry a rapid beam repeater (range 460). Enemy Commanders carry the **mega-beam**: a charged beam, range 900, every 10 s. It discharges as a heavy beam with a muzzle flare and shakes the screen when it passes within 450 of the ace.

1. **Charge (1.5 s):** a sight line over a wide band tracks the target.
2. **Lock (last 0.45 s):** the line freezes, bright and dashed.
3. **Fire:** the beam hits every hostile unit within 28 of the line, for 100 damage before scaling (50 to the ace).

A stun cancels the charge. **Aura:** units of its army within 230 fire 30% faster (shown as a faint ground ring). Always hunts the ace. Every army has at least two. An enemy Commander's death shows a banner.

## AI behavior

Each AI unit runs this loop every step (`SoldierAISystem`):

1. **Stunned:** stops and does nothing until the stun ends.
2. **Busy:** a Duelist mid-lunge does not steer. A unit charging a lance (a Sentinel, or an enemy Commander's mega-beam) keeps moving but fires nothing else.
3. **Target selection**, every 0.45–0.8 s, or immediately when the target dies. First match wins:
   1. **Decoy:** an enemy unit within a Decoy Beacon's 650 pull radius targets the decoy.
   2. **The ace:** a hunter within 800 of the ace, or a stalking unit at any distance, targets the ace.
   3. **Nearest hostile** within 900.
4. **Movement:**
   - Target beyond about 82% of weapon range: approach.
   - Class has `kiteDistance` and the target is closer than it: back away.
   - Otherwise: strafe sideways at half speed, changing direction every 1–3 s.
5. **Fire** when the target is in range and the weapon is ready. Shot timing varies by ±15%. A Commander's aura makes cooldowns run 30% faster.
   - **Close-quarters fire:** within 400 of the ace, a unit shooting at it leads it more (up to the full intercept), narrows its spread (to ×0.3) and fires more often (up to ×2), each rising linearly to full at point blank. Shots at other units are unaffected.
   - **Turns for charged attacks:** at most 2 units charge a lance or mega-beam at the ace at once, and each fires at least 0.6 s after the one before (the charge runs longer if needed). A unit without a turn holds fire and tries again 0.5 s later. Charges at other units need no turn.
6. **No target:** march toward the center of the opposing army.
7. **Leash:** a stalking semi-ace beyond 400 of the ace, or a pack member beyond 220 of its leader, heads back. It keeps firing at targets in range.

Also applied every step:

- **Separation:** overlapping units are pushed apart.
- **Lead:** units aim ahead of a moving target. The intercept time is solved in closed form; each weapon's `lead` (0–1) sets how much of it is used.

### Hunters

- **Always:** Lancer, Sentinel, Hornet, the semi-aces and the Commander (`huntsAce`).
- **By chance:** every other enemy unit has a 35% chance (`aceAggro`), rolled at spawn.
- **Allied units** never target the ace.

## Stalking and packs

- **Finding the ace.** An enemy semi-ace fights with its army until the ace comes within 800 (`aceHuntRange`). From then on it **stalks** the ace: it targets the ace at any distance and stays within 400 of it (`nearAce`).
- **Rallying.** When a semi-ace starts stalking, the nearest 10–20 free enemy units within 600 join its pack (`rally`). Other semi-aces and units already in a pack do not join.
- **Pack behavior.** Pack members target the ace at any distance and stay within 220 of their leader. Each carries a small pip in the leader's color.
- **Banner.** For example: "Enemy Duelist and 14 ALTERs are hunting you".
- **Leader's death.** The pack disbands and its members return to their army.

## Deployment and reinforcements

- **Allies:** 100 units in three groups on the west side. No reinforcements.
- **Enemies:** 300–600 (hangar setting).
  - **Initial deployment:** up to 240 units in four groups on the east side. The rest are held in reserve.
  - **Reinforcements:** a battalion of 60 enters from the east edge at a random height every 25 s, or as soon as fewer than 150 enemies remain on the field. The timer restarts with each battalion.
  - **Final reserves:** a banner marks the last battalion.
- **Composition:** each army is built from its class shares (`armies.json`), rounded, then raised to the minimums (at least two Commanders). The Trooper fills the remainder. Counts are fixed for a given army size; only the order is shuffled.
- **Formation depth:** Duelists, Bulwarks and Breachers deploy at the front; long-range classes and Commanders deploy behind.
- **Hangar skirmish:** an AI-only battle of 110 allies against 140 enemies with no ace. It restarts shortly after one side is eliminated.

## Related

- [reference.md](reference.md#unit-classes): stats, traits and counts per army size
- [data.md](data.md#unit-weapons-unitweaponsjson): unit weapon fields
- [mechanics.md](mechanics.md#damage): how armor, shields and `aceHitMul` combine
