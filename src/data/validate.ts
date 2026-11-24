import type { GameData } from './types';

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

/**
 * Cross-file sanity checks on the raw data. Returns human-readable problems (empty = valid).
 * That every behavior/effect/strategy/shape name has an implementation is checked
 * separately, against the registries (see src/sim/registryCheck.ts).
 */
export function validateGameData(d: GameData): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };

  const lists: [string, readonly { id: string }[]][] = [
    ['frames', d.frames.frames],
    ['weapons', d.weapons.weapons],
    ['tools', d.tools.tools],
    ['aimModes.modes', d.aimModes.modes],
    ['unitWeapons.weapons', d.unitWeapons.weapons],
    ['units.classes', d.units.classes],
  ];
  for (const [name, list] of lists) {
    check(Array.isArray(list) && list.length > 0, `${name} must be a non-empty list`);
    for (const id of duplicates(list.map((x) => x.id))) errors.push(`${name}: duplicate id "${id}"`);
  }

  const armamentIds = [...d.weapons.weapons.map((w) => w.id), ...d.tools.tools.map((t) => t.id)];
  for (const id of duplicates(armamentIds)) errors.push(`id "${id}" is used by both a weapon and a tool`);

  // Damage types and armor
  check(Array.isArray(d.damage.types) && d.damage.types.length > 0, 'damage.types must be a non-empty list');
  check(Array.isArray(d.damage.armor) && d.damage.armor.length > 0, 'damage.armor must be a non-empty list');
  for (const id of duplicates(d.damage.types.map((t) => t.id))) errors.push(`damage.types: duplicate id "${id}"`);
  for (const id of duplicates(d.damage.armor.map((a) => a.id))) errors.push(`damage.armor: duplicate id "${id}"`);
  const damageTypeIds = new Set(d.damage.types.map((t) => t.id));
  const armorIds = new Set(d.damage.armor.map((a) => a.id));
  for (const a of d.damage.armor) {
    for (const type of damageTypeIds) {
      const m = a.vs[type];
      check(typeof m === 'number' && m >= 0, `damage.armor.${a.id}.vs.${type} must be a number >= 0`);
    }
    for (const type of Object.keys(a.vs)) check(damageTypeIds.has(type), `damage.armor.${a.id}.vs: unknown damage type "${type}"`);
  }

  for (const w of d.weapons.weapons) {
    check(w.mag === null || (Number.isInteger(w.mag) && w.mag > 0), `weapons.${w.id}.mag must be null or a whole number > 0`);
    check(w.interval > 0, `weapons.${w.id}.interval must be > 0`);
    check(w.burstArc === undefined || (w.burstArc > 0 && w.burstArc <= 360), `weapons.${w.id}.burstArc must be in (0, 360]`);
    check(damageTypeIds.has(w.damageType), `weapons.${w.id}.damageType: unknown damage type "${w.damageType}"`);
    if (w.behavior === 'missile') check(w.homingDelay >= 0 && w.homingDelay < w.life, `weapons.${w.id}: need 0 <= homingDelay < life`);
  }
  for (const c of d.units.classes) check(armorIds.has(c.armor), `units.${c.id}.armor: unknown armor "${c.armor}"`);

  // Unit weapons
  const unitWeaponIds = new Set(d.unitWeapons.weapons.map((w) => w.id));
  for (const w of d.unitWeapons.weapons) {
    const at = `unitWeapons.${w.id}`;
    check(damageTypeIds.has(w.damageType), `${at}.damageType: unknown damage type "${w.damageType}"`);
    check(w.interval > 0 && w.range > 0 && w.dmg >= 0, `${at}: interval and range must be > 0, dmg >= 0`);
    if (w.behavior === 'shot') {
      check(['bullet', 'beam', 'shell'].includes(w.projectile), `${at}.projectile must be "bullet", "beam" or "shell"`);
      check(w.speed > 0, `${at}.speed must be > 0`);
      check(w.lead >= 0 && w.lead <= 1, `${at}.lead must be in 0..1`);
      check(w.pellets === undefined || (Number.isInteger(w.pellets) && w.pellets > 0), `${at}.pellets must be a whole number > 0`);
    } else if (w.behavior === 'missile') {
      check(Number.isInteger(w.salvo) && w.salvo > 0, `${at}.salvo must be a whole number > 0`);
      check(w.speed > 0 && w.life > 0, `${at}: speed and life must be > 0`);
      check(!w.weave || (w.weave.amplitude >= 0 && w.weave.frequency >= 0), `${at}.weave: amplitude and frequency must be >= 0`);
      check(w.homingDelay === undefined || (w.homingDelay >= 0 && w.homingDelay < w.life), `${at}: need 0 <= homingDelay < life`);
    } else if (w.behavior === 'saber') {
      check(w.slash > 0 && w.lungeSpeed > 0 && w.maxLunge > 0, `${at}: slash, lungeSpeed and maxLunge must be > 0`);
    } else if (w.behavior === 'lance') {
      check(w.charge > 0 && w.lock >= 0 && w.lock < w.charge, `${at}: need charge > 0 and 0 <= lock < charge`);
      check(w.interval >= w.charge, `${at}.interval must be >= charge`);
      check(w.lead >= 0 && w.lead <= 1, `${at}.lead must be in 0..1`);
    }
  }
  for (const c of d.units.classes) {
    check(unitWeaponIds.has(c.weapon), `units.${c.id}.weapon: unknown unit weapon "${c.weapon}"`);
    check(c.kiteDistance === undefined || c.kiteDistance > 0, `units.${c.id}.kiteDistance must be > 0`);
    check(c.aceHitMul === undefined || c.aceHitMul > 0, `units.${c.id}.aceHitMul must be > 0`);
    check(c.nearAce === undefined || c.nearAce > 0, `units.${c.id}.nearAce must be > 0`);
    if (c.rally) {
      const r = c.rally;
      check(Number.isInteger(r.min) && Number.isInteger(r.max) && r.min >= 0 && r.max >= r.min, `units.${c.id}.rally: need whole numbers 0 <= min <= max`);
      check(r.radius > 0 && r.follow > 0, `units.${c.id}.rally: radius and follow must be > 0`);
    }
    if (c.shield) check(c.shield.duration > 0 && c.shield.cooldown > c.shield.duration, `units.${c.id}.shield: need duration > 0 and cooldown > duration`);
  }

  // Aim modes
  for (const key of duplicates(d.aimModes.modes.map((m) => m.key))) errors.push(`aimModes: key "${key}" is used twice`);
  for (const m of d.aimModes.modes) check(m.key.length === 1, `aimModes.${m.id}.key must be one character`);

  // Armies
  const classIds = new Set(d.units.classes.map((c) => c.id));
  const a = d.armies;
  for (const [mixName, mix] of [['allyMix', a.allyMix], ['enemyMix', a.enemyMix]] as const) {
    let total = 0;
    for (const [id, share] of Object.entries(mix)) {
      check(classIds.has(id), `armies.${mixName}: unknown unit class "${id}"`);
      check(share >= 0, `armies.${mixName}.${id} must be >= 0`);
      total += share;
    }
    check(total <= 1, `armies.${mixName} shares sum to ${total}; the filler class needs the rest (<= 1)`);
  }
  check(classIds.has(a.fillerClass), `armies.fillerClass: unknown unit class "${a.fillerClass}"`);
  const semiAces = new Set(d.units.classes.filter((c) => c.semiAce).map((c) => c.id));
  for (const id of [...Object.keys(a.allyMix), ...Object.keys(a.minimums), a.fillerClass]) {
    check(!semiAces.has(id), `armies: semi-ace "${id}" can only serve in the enemy army (allyMix, minimums and fillerClass apply to the allies)`);
  }
  for (const id of Object.keys(a.minimums)) check(classIds.has(id), `armies.minimums: unknown unit class "${id}"`);
  check(a.battle.enemies.groups > 0 && a.battle.allies.groups > 0, 'armies.battle: groups must be > 0');

  // Loadout
  const l = d.loadout;
  const frameIds = new Set(d.frames.frames.map((f) => f.id));
  const weaponIds = new Set(d.weapons.weapons.map((w) => w.id));
  const aimIds = new Set(d.aimModes.modes.map((m) => m.id));
  check(l.slots > 0, 'loadout.slots must be > 0');
  check(l.enemyCount.min <= l.enemyCount.max, 'loadout.enemyCount: min must be <= max');
  check(frameIds.has(l.defaultLoadout.frame), `loadout.defaultLoadout.frame: unknown frame "${l.defaultLoadout.frame}"`);
  check(aimIds.has(l.defaultLoadout.aim), `loadout.defaultLoadout.aim: unknown aim mode "${l.defaultLoadout.aim}"`);
  check(l.defaultLoadout.slots.length === l.slots, `loadout.defaultLoadout must fill all ${l.slots} slots`);
  check(l.defaultLoadout.slots.some((id) => weaponIds.has(id)), 'loadout.defaultLoadout needs at least one weapon');
  for (const id of l.defaultLoadout.slots) {
    check(armamentIds.includes(id), `loadout.defaultLoadout: unknown weapon or tool "${id}"`);
  }
  for (const id of duplicates(l.defaultLoadout.slots)) errors.push(`loadout.defaultLoadout: "${id}" is equipped twice`);

  // Battle
  const b = d.battle;
  check(b.world.width > 0 && b.world.height > 0 && b.world.cellSize > 0, 'battle.world: sizes must be > 0');
  check(b.camera.minZoom > 0 && b.camera.minZoom <= b.camera.maxZoom, 'battle.camera: need 0 < minZoom <= maxZoom');
  const mv = b.player.movement;
  if (mv.model === 'thruster') {
    check(mv.thrustTime > 0, 'battle.player.movement.thrustTime must be > 0');
    check(mv.drag >= 0 && mv.lateralDrag >= 0, 'battle.player.movement: drag and lateralDrag must be >= 0');
    check(mv.dashCarry >= 0 && mv.dashCarry <= 1, 'battle.player.movement.dashCarry must be in 0..1');
  } else if (mv.model === 'direct') {
    check(mv.response > 0, 'battle.player.movement.response must be > 0');
  }
  const sr = b.player.superRelease;
  check(sr.duration > 0 && sr.cooldown >= sr.duration, 'battle.player.superRelease: need duration > 0 and cooldown >= duration');
  check(sr.openingBurst >= 0, 'battle.player.superRelease.openingBurst must be >= 0');
  check(b.ranks.length > 0 && b.ranks[b.ranks.length - 1]!.minShare === 0, 'battle.ranks: the last rank must have minShare 0');
  for (let i = 1; i < b.ranks.length; i++) {
    check(b.ranks[i]!.minShare < b.ranks[i - 1]!.minShare, 'battle.ranks must be ordered from highest minShare to lowest');
  }

  return errors;
}
