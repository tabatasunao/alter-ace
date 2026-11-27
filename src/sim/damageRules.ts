import type { Hit, HitResult, Player, Soldier, Unit } from './entities';
import { kick } from './impact';
import { statMul } from './statuses';
import type { World } from './World';

/**
 * One step of the damage rules: returns the damage left after the rule, or null if the hit does
 * nothing at all. Each unit kind runs its rules in order (DAMAGE_RULES). To add a modifier, write
 * a rule and slot it into the lists; Combat doesn't change.
 */
export type DamageRule<U extends Unit = Unit> = (u: U, amount: number, hit: Hit, world: World) => number | null;

/** The ace has no armor class: only the global scale and its statuses (Full Arms) apply. */
const aceScale: DamageRule<Player> = (u, amount, _hit, world) =>
  amount * (world.catalog.battle.balance.aceDamageTaken * statMul(u, 'damageTaken'));

/** Records a hit on the ace (stats, and it delays regeneration). Runs last. */
const recordAceHit: DamageRule<Player> = (u, amount, _hit, world) => {
  world.stats.dmgTaken += amount;
  u.lastHit = world.t;
  return amount;
};

/**
 * Every hit that lands on the ace: the ace jolts, a red ring pops off it, the screen edges redden
 * and the view shakes, all scaled by the damage (full at `fullShare` of max HP).
 */
const aceHitReaction: DamageRule<Player> = (u, amount, _hit, world) => {
  const h = world.catalog.battle.impact.aceHit;
  const k = Math.min(1, amount / (u.maxHp * h.fullShare));
  if (k <= 0) return amount;
  kick(world, h, k);
  const fresh = u.hurtT < h.react * 0.5;
  u.hurtK = fresh ? k : Math.max(k, u.hurtK);
  u.hurtT = h.react;
  if (fresh) world.addFx({ type: 'pulse', x: u.x, y: u.y, r: 24 + 22 * k, t: 0, life: 0.22, tone: 'danger' });
  return amount;
};

/** A hit that takes a big share of the ace's HP lands with hit-stop, shake and a danger flash. Runs last. */
const heavyHitImpact: DamageRule<Player> = (u, amount, _hit, world) => {
  const h = world.catalog.battle.impact.heavyHit;
  if (amount >= u.maxHp * h.minShare) kick(world, h);
  return amount;
};

/** Seconds between hit labels over the same unit, so rapid fire doesn't stack text. */
const LABEL_GAP = 0.45;

/**
 * Marks one of the ace's hits that a unit's defenses changed. Markers come at most once per hit
 * flash; text labels at most once per LABEL_GAP per unit. `labelOnly` skips the plain marker
 * (shield blocks don't flash the unit, so they'd otherwise mark every hit).
 */
function markAceHit(world: World, u: Soldier, hit: Hit, result: HitResult, labelOnly = false): void {
  if (hit.src !== 'player' || u.flash > 0) return;
  const label = world.t - u.labelAt >= LABEL_GAP;
  if (!label && labelOnly) return;
  if (label) u.labelAt = world.t;
  world.addFx({ type: 'hitMarker', x: u.x, y: u.y, t: 0, life: label ? 0.75 : 0.3, result, dtype: hit.dtype, label });
}

/** A semi-ace's shield blocks the hit if it is up, or rises now (blocking this hit) if it is ready. */
const shield: DamageRule<Soldier> = (u, amount, hit, world) => {
  const s = u.def.shield;
  if (!s) return amount;
  if (u.shieldT <= 0) {
    if (u.shieldCd > 0 || u.stunT > 0) return amount;
    u.shieldT = s.duration;
    u.shieldCd = s.cooldown;
  }
  markAceHit(world, u, hit, 'shielded', true);
  return null;
};

/** Hits from AI units on AI units are scaled by `unitVsUnit` (and the weapon's `armyMul`); the ace's hits are not. */
const armySoftening: DamageRule = (_u, amount, hit, world) =>
  hit.src === 'player' ? amount : amount * world.catalog.battle.balance.unitVsUnit * (hit.armyMul ?? 1);

/** Normal ALTERs fold faster to aces: the player's hits and semi-aces' hits. */
const aceVulnerability: DamageRule<Soldier> = (u, amount, hit) =>
  u.def.aceHitMul && (hit.src === 'player' || hit.semiAce) ? amount * u.def.aceHitMul : amount;

/** The hit's damage type against the unit's armor. Only the ace's hits get a marker; the armies' would flood the field. */
const armor: DamageRule<Soldier> = (u, amount, hit, world) => {
  if (!hit.dtype) return amount;
  const m = world.catalog.armorMultiplier(hit.dtype, u.def.armor);
  if (m !== 1) markAceHit(world, u, hit, m > 1 ? 'critical' : 'resisted');
  return amount * m;
};

/** An exposed unit (stunned by a `mortar` shell) takes × `exposedMul` from the ace's side, marked EXPOSED on the ace's hits. */
const exposed: DamageRule<Soldier> = (u, amount, hit, world) => {
  if (u.exposedT <= 0) return amount;
  markAceHit(world, u, hit, 'exposed');
  return amount * u.exposedMul;
};

/** A heavy hit from the ace makes the unit judder for a moment (drawn by UnitLayer). Runs last. */
const stagger: DamageRule<Soldier> = (u, amount, hit, world) => {
  const s = world.catalog.battle.impact.stagger;
  if (hit.src === 'player' && amount >= s.minDamage) u.stagger = s.time;
  return amount;
};

type RuleTable = { readonly [K in Unit['kind']]: readonly DamageRule<Extract<Unit, { kind: K }>>[] };

/** The damage rules each kind of unit runs, in order. */
export const DAMAGE_RULES: RuleTable = {
  player: [aceScale, recordAceHit, aceHitReaction, heavyHitImpact],
  soldier: [shield, armySoftening, aceVulnerability, armor, exposed, stagger],
};
