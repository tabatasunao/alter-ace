import { FRAME_STATS } from './types';
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
/** What a tutorial stage's `keys` may name: the rebindable actions (src/game/settings.ts), and `slots` for every hardpoint. */
const TUTORIAL_KEYS = new Set(['up', 'down', 'left', 'right', 'dash', 'release', 'aimPrev', 'aimNext', 'reload', 'pause', 'zoomIn', 'zoomOut', 'slots']);

export function validateGameData(d: GameData): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };

  const lists: [string, readonly { id: string }[]][] = [
    ['weapons', d.weapons.weapons],
    ['aimModes.modes', d.aimModes.modes],
    ['unitWeapons.weapons', d.unitWeapons.weapons],
    ['units.classes', d.units.classes],
  ];
  for (const [name, list] of lists) {
    check(Array.isArray(list) && list.length > 0, `${name} must be a non-empty list`);
    for (const id of duplicates(list.map((x) => x.id))) errors.push(`${name}: duplicate id "${id}"`);
  }

  for (const w of d.weapons.weapons) {
    if (w.movingFireInterval !== undefined) check(w.movingFireInterval > 0, `weapons.${w.id}.movingFireInterval must be > 0`);
    if (w.fullArmsFireInterval !== undefined) check(w.fullArmsFireInterval > 0, `weapons.${w.id}.fullArmsFireInterval must be > 0`);
    if (w.viewZoom !== undefined) check(w.viewZoom > 0, `weapons.${w.id}.viewZoom must be > 0`);
    if (w.behavior === 'rail' && w.steady) {
      const st = w.steady;
      check(st.still > 0 && st.moving > 0, `weapons.${w.id}.steady: still and moving must be > 0`);
      check(st.fullBelow >= 0 && st.fullBelow <= 1 && st.fullBonus >= 1, `weapons.${w.id}.steady: fullBelow must be 0–1 and fullBonus >= 1`);
    }
    if (w.behavior === 'shotgun') check(w.pellets >= 1 && w.knock.push >= 0 && w.knock.time > 0 && w.jolt.distance >= 0 && w.jolt.time > 0 && w.jolt.carry >= 0, `weapons.${w.id}: need pellets >= 1, knock.push >= 0, knock.time > 0, jolt.distance and jolt.carry >= 0 and jolt.time > 0`);
    if (w.swingZoom !== undefined) check(w.swingZoom > 0, `weapons.${w.id}.swingZoom must be > 0`);
    if (w.behavior === 'sniper') check(w.sight >= 0 && w.sight < w.interval && w.beamWidth > 0, `weapons.${w.id}: need 0 <= sight < interval and beamWidth > 0`);
    if (w.behavior === 'mortar') {
      check(w.stun.radius > 0 && w.stun.time > 0 && w.stun.exposedMul >= 1, `weapons.${w.id}.stun: need radius > 0, time > 0 and exposedMul >= 1`);
      check(w.track >= 0, `weapons.${w.id}.track must be >= 0`);
    }
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
    check(w.armyMul === undefined || w.armyMul > 0, `${at}.armyMul must be > 0`);
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
      check(!w.terminal || (w.terminal.range > 0 && w.terminal.time > 0 && w.terminal.turnRate >= w.turnRate), `${at}.terminal: need range and time > 0, and turnRate >= the weapon's turnRate`);
      check(!w.terminal || (w.terminal.lead >= 0 && w.terminal.lead <= 1), `${at}.terminal.lead must be in 0..1`);
    } else if (w.behavior === 'saber') {
      check(w.slash > 0 && w.lungeSpeed > 0 && w.maxLunge > 0, `${at}: slash, lungeSpeed and maxLunge must be > 0`);
      const d = w.dash;
      check(!d || (d.range > w.range && d.speed > 0 && d.cooldown > 0 && d.dmg >= 0), `${at}.dash: need range > the weapon's range, speed and cooldown > 0, dmg >= 0`);
      check(!d || (d.windup > 0 && d.lock >= 0 && d.lock < d.windup), `${at}.dash: need windup > 0 and 0 <= lock < windup`);
      check(!w.retreat || (w.retreat.distance >= 0 && w.retreat.time > 0), `${at}.retreat: need distance >= 0 and time > 0`);
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
    check(!c.holdLine || c.holdLine.band > 0, `units.${c.id}.holdLine.band must be > 0`);
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

  // Tutorial
  const tu = a.tutorial;
  if (!tu || !Array.isArray(tu.stages) || tu.stages.length === 0) {
    errors.push('armies.tutorial.stages must be a non-empty list');
  } else {
    check(tu.recenterStep > 0, 'armies.tutorial.recenterStep must be > 0');
    check(tu.spawnDistance > 0 && tu.spawnOffscreen >= 0 && tu.stageGap >= 0 && tu.respawnGap >= 0, 'armies.tutorial: need spawnDistance > 0, spawnOffscreen >= 0, stageGap >= 0 and respawnGap >= 0');
    const fu = tu.followUp;
    check(Number.isInteger(fu?.allies) && fu.allies >= 1 && Number.isInteger(fu.enemies) && fu.enemies >= 1 && fu.delay >= 0 && fu.offscreen >= 0 && fu.groupSpacing > 0,
      'armies.tutorial.followUp: need whole allies >= 1 and enemies >= 1, delay >= 0, offscreen >= 0 and groupSpacing > 0');
    const exact = Object.entries(fu?.exact ?? {});
    for (const [id, n] of exact) check(classIds.has(id) && Number.isInteger(n) && n >= 0, `armies.tutorial.followUp.exact: unknown class "${id}" or count not a whole number >= 0`);
    check(exact.reduce((sum, [, n]) => sum + n, 0) <= (fu?.enemies ?? 0), 'armies.tutorial.followUp.exact: more units than enemies');
    check(tu.hpFloor > 0 && tu.hpFloor < 1, 'armies.tutorial.hpFloor must be between 0 and 1');
    for (const id of duplicates(tu.stages.map((s) => s.id))) errors.push(`armies.tutorial: duplicate stage id "${id}"`);
    const uses = new Set(['weapons', 'aim', 'dash', 'fullArms']);
    for (const s of tu.stages) {
      const at = `armies.tutorial.${s.id}`;
      check(typeof s.text === 'string' && s.text.length > 0 && typeof s.touchText === 'string' && s.touchText.length > 0, `${at}: needs text and touchText`);
      check(Array.isArray(s.keys) && s.keys.every((k) => TUTORIAL_KEYS.has(k)), `${at}.keys: each must be an action id or "slots"`);
      check(s.keys.length === 0 || s.text.includes('{keys}'), `${at}: text with keys must contain {keys}`);
      if (s.use !== undefined) check(uses.has(s.use), `${at}.use: unknown control "${s.use}"`);
      if (s.groups !== undefined) check(s.spawn.length > 0 && Number.isInteger(s.groups) && s.groups >= 1 && (s.groups === 1 || (s.groupSpacing ?? 0) > 0), `${at}.groups: needs enemies, a whole number >= 1, and groupSpacing > 0 for more than one`);
      if (s.spacing !== undefined) check(s.spacing > 0, `${at}.spacing must be > 0`);
      if (s.waves !== undefined) check(s.spawn.length > 0 && Number.isInteger(s.waves) && s.waves >= 1, `${at}.waves: needs enemies, and a whole number >= 1`);
      if (s.useCount !== undefined) check(!!s.use && Number.isInteger(s.useCount) && s.useCount >= 1, `${at}.useCount: needs a control to use, and a whole number >= 1`);
      for (const m of s.markers ?? []) check(Number.isFinite(m.dx) && Number.isFinite(m.dy) && m.radius > 0, `${at}.markers: need numbers dx, dy and radius > 0`);
      if (s.kill) {
        check(!!s.use, `${at}.kill: needs a control to use (kills count after it)`);
        check(Number.isInteger(s.kill.count) && s.kill.count > 0, `${at}.kill.count must be a whole number > 0`);
        if (s.kill.damageType !== undefined) check(damageTypeIds.has(s.kill.damageType), `${at}.kill.damageType: unknown damage type "${s.kill.damageType}"`);
      }
      check((s.afterText === undefined) === (s.afterTouchText === undefined), `${at}: afterText and afterTouchText go together`);
      if (s.afterText !== undefined) check(!!s.use && s.afterText.length > 0 && !!s.afterTouchText, `${at}.afterText: needs a control to use, and text`);
      for (const g of s.spawn) check(classIds.has(g.class) && Number.isInteger(g.count) && g.count > 0, `${at}.spawn: unknown class "${g.class}" or count not a whole number > 0`);
      check(!!s.markers?.length || !!s.use || s.spawn.length > 0, `${at}: needs a ring, a control to use or enemies, or it clears at once`);
    }
  }

  // Frame build
  const fb = d.frames;
  check(fb.points > 0 && Number.isInteger(fb.maxPerStat) && fb.maxPerStat > 0, 'frames: need points > 0 and a whole maxPerStat > 0');
  for (const s of FRAME_STATS) {
    const st = fb.stats?.[s];
    check(!!st && Number.isFinite(st.min) && Number.isFinite(st.max), `frames.stats.${s}: needs min and max`);
  }
  check(fb.stats.speed.min > 0 && fb.stats.hp.min > 0 && fb.stats.reload.max > 0 && fb.stats.fireRate.max > 0 && fb.stats.dash.max > 0, 'frames.stats: speed, HP and the multipliers must stay above 0');
  const checkBuild = (build: Record<string, number> | undefined, at: string) => {
    if (!build) return check(false, `${at} is missing`);
    let total = 0;
    for (const s of FRAME_STATS) {
      const n = build[s];
      check(Number.isInteger(n) && n! >= 0 && n! <= fb.maxPerStat, `${at}.${s} must be a whole number from 0 to ${fb.maxPerStat}`);
      total += n ?? 0;
    }
    check(total <= fb.points, `${at} spends ${total} points; the frame has ${fb.points}`);
  };
  for (const p of fb.presets ?? []) checkBuild(p.build, `frames.presets "${p.name}"`);

  // Loadout
  const l = d.loadout;
  const weaponIds = new Set(d.weapons.weapons.map((w) => w.id));
  const aimIds = new Set(d.aimModes.modes.map((m) => m.id));
  check(l.slots > 0, 'loadout.slots must be > 0');
  check(l.enemyCount.min <= l.enemyCount.max, 'loadout.enemyCount: min must be <= max');
  checkBuild(l.defaultLoadout.build, 'loadout.defaultLoadout.build');
  check(typeof l.defaultLoadout.name === 'string' && l.defaultLoadout.name.trim().length > 0, 'loadout.defaultLoadout.name must be a non-empty string');
  check(aimIds.has(l.defaultLoadout.aim), `loadout.defaultLoadout.aim: unknown aim mode "${l.defaultLoadout.aim}"`);
  check(l.defaultLoadout.slots.length === l.slots, `loadout.defaultLoadout must fill all ${l.slots} slots`);
  for (const id of l.defaultLoadout.slots) check(weaponIds.has(id), `loadout.defaultLoadout: unknown weapon "${id}"`);
  for (const id of duplicates(l.defaultLoadout.slots)) errors.push(`loadout.defaultLoadout: "${id}" is equipped twice`);

  // Battle
  const b = d.battle;
  check(b.world.width > 0 && b.world.height > 0 && b.world.cellSize > 0, 'battle.world: sizes must be > 0');
  check(b.camera.minZoom > 0 && b.camera.minZoom <= b.camera.maxZoom, 'battle.camera: need 0 < minZoom <= maxZoom');
  check(b.camera.swingHold >= 0, 'battle.camera.swingHold must be >= 0');
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
  check(ch.start >= 0 && ch.start <= 1, 'battle.player.superRelease.charge.start must be 0–1');
  check(ch.perHpTaken >= 0, 'battle.player.superRelease.charge.perHpTaken must be >= 0');
  check(!!ch.graze && ch.graze.radius > 0 && ch.graze.perShot >= 0 && ch.graze.perLine >= 0 && ch.graze.markGap >= 0, 'battle.player.superRelease.charge.graze: need radius > 0, and perShot, perLine and markGap >= 0');
  check(ch.perKill > 0 || ch.perSecond > 0, 'battle.player.superRelease.charge: perKill or perSecond must be > 0, or the gauge never refills');
  check(b.player.launch.speed >= 0 && b.player.launch.zoom > 0, 'battle.player.launch: need speed >= 0 and zoom > 0');
  const dg = b.player.dodge;
  check(dg.dashRefund >= 0 && dg.dashRefund <= 1 && dg.releaseCharge >= 0, 'battle.player.dodge: need 0 <= dashRefund <= 1 and releaseCharge >= 0');

  const im = b.impact;
  check(im.freezeGap >= 0 && im.shakeTime > 0 && im.flashTime > 0 && im.hurtTime > 0, 'battle.impact: need freezeGap >= 0 and shakeTime, flashTime and hurtTime > 0');
  check(b.clash.acePush >= 0 && b.clash.unitPush >= 0 && b.clash.pushTime > 0, 'battle.clash: need acePush, unitPush >= 0 and pushTime > 0');
  for (const key of ['aceHit', 'bigKill', 'heavyHit', 'release', 'dodge', 'slash', 'railFull', 'shotgun', 'launch', 'clash', 'aceDeath', 'blast', 'beam'] as const) {
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
