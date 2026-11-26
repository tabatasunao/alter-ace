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
  for (const w of d.weapons.weapons) {
    if (w.movingFireInterval !== undefined) check(w.movingFireInterval > 0, `weapons.${w.id}.movingFireInterval must be > 0`);
    if (w.spin) check(w.spin.start > 0 && w.spin.top > 0 && w.spin.upTime > 0 && w.spin.downTime > 0, `weapons.${w.id}.spin: values must be > 0`);
    if (w.heat) check(w.mag !== null && w.heat.coolPerSecond >= 0 && w.heat.coolDelay >= 0, `weapons.${w.id}.heat: needs a mag (the shots to overheat) and coolPerSecond, coolDelay >= 0`);
    if (w.behavior === 'rail' && w.steady) check(w.steady.still > 0 && w.steady.moving > 0, `weapons.${w.id}.steady: values must be > 0`);
    if (w.behavior === 'breach') {
      check(Number.isInteger(w.blastEvery) && w.blastEvery >= 1 && w.mag !== null, `weapons.${w.id}: blastEvery must be a whole number >= 1, with a magazine`);
      check(w.blast.radius > 0 && w.blast.dmg >= 0 && w.blast.push >= 0 && w.blast.pushTime > 0 && w.recoil >= 0, `weapons.${w.id}.blast: need radius > 0, pushTime > 0 and dmg, push, recoil >= 0`);
    }
    if (w.behavior === 'mortar') check(w.stun.radius > 0 && w.stun.time > 0 && w.stun.exposedMul >= 1, `weapons.${w.id}.stun: need radius > 0, time > 0 and exposedMul >= 1`);
  }
  for (const t of d.tools.tools) {
    if (t.effect === 'emp') check(t.releaseInterval > 0, `tools.${t.id}.releaseInterval must be > 0`);
    if (t.effect === 'decoy') check(t.releaseInterval > 0 && t.releaseHp > 0 && t.releaseLife > 0, `tools.${t.id}: releaseInterval, releaseHp and releaseLife must be > 0`);
  }

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
    check(c.enemyWeapon === undefined || unitWeaponIds.has(c.enemyWeapon), `units.${c.id}.enemyWeapon: unknown unit weapon "${c.enemyWeapon}"`);
    if (c.heal) check(c.heal.interval > 0 && c.heal.radius > 0 && c.heal.amount > 0 && c.heal.amount <= 1, `units.${c.id}.heal: need interval > 0, radius > 0 and 0 < amount <= 1`);
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
  const ca = b.ai.closeAim;
  check(ca.range >= 0 && ca.lead >= 0 && ca.lead <= 1 && ca.spread >= 0 && ca.spread <= 1 && ca.fireRate >= 1, 'battle.ai.closeAim: need range >= 0, lead and spread in 0..1, and fireRate >= 1');
  const ac = b.ai.aceCharges;
  check(Number.isInteger(ac.max) && ac.max >= 1 && ac.gap >= 0 && ac.retry > 0, 'battle.ai.aceCharges: need a whole max >= 1, gap >= 0 and retry > 0');
  const mv = b.player.movement;
  if (mv.model === 'thruster') {
    check(mv.thrustTime > 0, 'battle.player.movement.thrustTime must be > 0');
    check(mv.drag >= 0 && mv.lateralDrag >= 0, 'battle.player.movement: drag and lateralDrag must be >= 0');
    check(mv.dashCarry >= 0 && mv.dashCarry <= 1, 'battle.player.movement.dashCarry must be in 0..1');
  } else if (mv.model === 'direct') {
    check(mv.response > 0, 'battle.player.movement.response must be > 0');
  }
  const sr = b.player.superRelease;
  check(sr.duration > 0, 'battle.player.superRelease.duration must be > 0');
  check(sr.openingBurst >= 0 && sr.openingIframes >= 0, 'battle.player.superRelease: openingBurst and openingIframes must be >= 0');
  check(sr.damageTakenMul >= 0, 'battle.player.superRelease.damageTakenMul must be >= 0');
  const ch = sr.charge;
  check(ch.perKill >= 0 && ch.perSecond >= 0 && ch.closeRadius >= 0 && ch.closeKillMul >= 0, 'battle.player.superRelease.charge: values must be >= 0');
  check(ch.perKill > 0 || ch.perSecond > 0, 'battle.player.superRelease.charge: perKill or perSecond must be > 0, or the gauge never refills');
  const dg = b.player.dodge;
  check(dg.dashRefund >= 0 && dg.dashRefund <= 1 && dg.releaseCharge >= 0, 'battle.player.dodge: need 0 <= dashRefund <= 1 and releaseCharge >= 0');

  const im = b.impact;
  check(im.freezeGap >= 0 && im.shakeTime > 0 && im.flashTime > 0 && im.hurtTime > 0, 'battle.impact: need freezeGap >= 0 and shakeTime, flashTime and hurtTime > 0');
  check(b.clash.acePush >= 0 && b.clash.unitPush >= 0 && b.clash.pushTime > 0, 'battle.clash: need acePush, unitPush >= 0 and pushTime > 0');
  for (const key of ['aceHit', 'bigKill', 'heavyHit', 'release', 'dodge', 'slash', 'clash', 'aceDeath', 'blast', 'beam'] as const) {
    const k = im[key];
    const hurt = k.hurt ?? 0;
    check(k.freeze >= 0 && k.shake >= 0 && k.flash >= 0 && k.flash <= 1 && hurt >= 0 && hurt <= 1, `battle.impact.${key}: need freeze >= 0, shake >= 0, and flash and hurt in 0..1`);
  }
  check(im.aceHit.fullShare > 0 && im.aceHit.react >= 0, 'battle.impact.aceHit: need fullShare > 0 and react >= 0');
  check(im.beam.minWidth >= 0 && im.beam.range > 0, 'battle.impact.beam: need minWidth >= 0 and range > 0');
  check(im.heavyHit.minShare > 0, 'battle.impact.heavyHit.minShare must be > 0');
  check(im.aceDeath.slow >= 0 && im.aceDeath.slowScale > 0 && im.aceDeath.slowScale <= 1, 'battle.impact.aceDeath: need slow >= 0 and 0 < slowScale <= 1');
  check(im.blast.minRadius >= 0 && im.blast.range > 0, 'battle.impact.blast: need minRadius >= 0 and range > 0');
  check(im.stagger.minDamage > 0 && im.stagger.time >= 0, 'battle.impact.stagger: need minDamage > 0 and time >= 0');

  const r = b.rating;
  check(r.pointsPerEnemy > 0 && r.parSecondsPerEnemy > 0, 'battle.rating: pointsPerEnemy and parSecondsPerEnemy must be > 0');
  check(r.paceMin > 0 && r.paceMin <= r.paceMax, 'battle.rating: need 0 < paceMin <= paceMax');
  check(r.damagePerMaxHp >= 0 && r.integrityMin > 0 && r.integrityMin <= 1 && r.lineBonus >= 0, 'battle.rating: need damagePerMaxHp >= 0, 0 < integrityMin <= 1 and lineBonus >= 0');
  check(r.ranks.length > 0 && r.ranks[r.ranks.length - 1]!.minScore === 0, 'battle.rating.ranks: the last rank must have minScore 0');
  for (let i = 1; i < r.ranks.length; i++) {
    check(r.ranks[i]!.minScore < r.ranks[i - 1]!.minScore, 'battle.rating.ranks must be ordered from highest minScore to lowest');
  }

  const pr = b.praise;
  check(Number.isInteger(pr.killMilestone) && pr.killMilestone > 0, 'battle.praise.killMilestone must be a whole number > 0');
  check(pr.streak.kills > 0 && pr.streak.window > 0 && pr.streak.cooldown >= 0, 'battle.praise.streak: need kills > 0, window > 0 and cooldown >= 0');
  check(pr.releaseMinKills >= 0, 'battle.praise.releaseMinKills must be >= 0');

  check(l.medals.length > 0, 'loadout.medals needs at least one medal');
  for (let i = 0; i < l.medals.length; i++) {
    check(l.medals[i]!.kills > 0 && (i === 0 || l.medals[i]!.kills > l.medals[i - 1]!.kills), 'loadout.medals must have kills > 0, ordered from lowest to highest');
  }

  return errors;
}
