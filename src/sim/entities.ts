import type { Point } from '../core/math';
import type { FrameDef, ToolDef, UnitClassDef, UnitWeaponDef, WeaponDef } from '../data/types';

export type Team = 0 | 1;
export const ALLY: Team = 0;
export const ENEMY: Team = 1;

/** Who caused damage: the ace's weapons, or the AI armies. */
export type DamageSource = 'player' | 'army';

/** Where a hit came from. Projectiles carry these fields, so a shot can be passed as its own Hit. */
export interface Hit {
  readonly src: DamageSource;
  /** The ace's weapon id, for kill credit; null for AI fire. */
  readonly wid: string | null;
  /** Damage type id (damage.json), scaled by the target's armor; null = untyped. */
  readonly dtype: string | null;
  /** Fired by a semi-ace: counts like the ace's own hits against a class's `aceHitMul`. */
  readonly semiAce?: boolean;
}

// ---------- Units ----------

interface UnitBase {
  readonly id: number;
  readonly team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  readonly size: number;
  alive: boolean;
  /** Spatial grid cell, refreshed every step. */
  cell: number;
  /** Hit flash timer. */
  flash: number;
  stunT: number;
}

/** An aim line drawn while an action aims (a charging Beam lance). */
export interface SightLine {
  readonly angle: number;
  readonly range: number;
  /** Frozen just before it fires: the cue to dodge. */
  readonly locked: boolean;
  readonly target: Unit;
}

/**
 * Something a unit is busy doing over time: charging a lance, lunging with a saber. A weapon
 * behavior starts it; UnitActionSystem steps it and drops it if the unit is stunned or dies.
 */
export interface UnitAction {
  /** While true the AI neither moves the unit nor fires (the action moves it); otherwise the AI only holds fire. */
  readonly holdsAI: boolean;
  /** The aim line to draw while it runs, if it has one. */
  readonly sightLine: SightLine | null;
  /** Advances one step; returns true when the action is finished. */
  step(dt: number): boolean;
}

/** An AI-controlled ALTER of either army. */
export interface Soldier extends UnitBase {
  readonly kind: 'soldier';
  readonly def: UnitClassDef;
  /** The class's weapon (resolved from `def.weapon` once, at deployment). */
  readonly weapon: UnitWeaponDef;
  /** What the unit is busy doing (a charge, a lunge), if anything. */
  action: UnitAction | null;
  /** Fire-rate buff from a friendly aura (Commander): time left and multiplier. */
  buffT: number;
  buffMul: number;
  /** Shield time left (semi-aces); while > 0 nothing hurts the unit. */
  shieldT: number;
  /** Time until the shield can rise again. */
  shieldCd: number;
  /** Battle time of the last hit label shown over this unit (labels are throttled per unit). */
  labelAt: number;
  /** Time until the next shot. */
  cd: number;
  /** Time until the next target pick. */
  retarget: number;
  target: Unit | null;
  strafe: 1 | -1;
  strafeT: number;
  /** Goes after the ace when it is close. */
  readonly hunter: boolean;
  /** Hunts the ace at any distance: an enemy semi-ace that found it, or a member of its pack (see StalkSystem). */
  stalking: boolean;
  /** The stalking semi-ace whose pack this unit joined: it keeps near it. Null when not in a pack. */
  leader: Soldier | null;
}

/** The ace's Decoy Beacon: a stationary allied unit that pulls enemy fire. */
export interface Decoy extends UnitBase {
  readonly kind: 'decoy';
  life: number;
  readonly pullRadius: number;
}

export interface WeaponSlot {
  readonly kind: 'weapon';
  readonly def: WeaponDef;
  /** Rounds left; Infinity for unlimited weapons. */
  ammo: number;
  reloadT: number;
  reloadTotal: number;
  /** Time until the next shot. */
  cd: number;
}

export interface ToolSlot {
  readonly kind: 'tool';
  readonly def: ToolDef;
  cd: number;
  cdTotal: number;
}

export type Slot = WeaponSlot | ToolSlot;

/** A timed straight-line move (dash or saber lunge). */
export interface Motion {
  remaining: number;
  vx: number;
  vy: number;
}

export interface Lunge extends Motion {
  /** Runs when the lunge ends (the saber's slash). */
  onArrive: () => void;
}

/** Stats a status can scale (multipliers; 1 = unchanged). `fireInterval` < 1 fires faster. */
export type StatusStat = 'speed' | 'fireInterval' | 'damageTaken';

/** A timed effect on the ace from a tool (Overboost, Repair Nanites). See src/sim/statuses.ts. */
export interface Status {
  /** The tool that gave it; using that tool again replaces it. */
  readonly id: string;
  /** Shown on the HUD. */
  readonly label: string;
  remaining: number;
  readonly mods: Partial<Record<StatusStat, number>>;
  /** HP restored per second. */
  readonly heal: number;
  /** Shown as a ring around the ace. */
  readonly ring: boolean;
  /** While it runs, every weapon hardpoint fires, not just the active one (super release). */
  readonly allWeapons?: boolean;
}

/** The ace. */
export interface Player extends UnitBase {
  readonly kind: 'player';
  readonly frame: FrameDef;
  readonly slots: Slot[];
  /** Index of the active weapon slot. */
  active: number;
  facing: number;
  iframes: number;
  dashCd: number;
  /** Time until super release can be used again. */
  releaseCd: number;
  dash: Motion | null;
  lunge: Lunge | null;
  /** Timed effects from tools, in the order they were applied. */
  statuses: Status[];
  /** Battle time of the last hit taken (drives regeneration). */
  lastHit: number;
  reticle: Soldier | null;
  /** Movement input this step, length <= 1. */
  input: Point;
}

export type Unit = Soldier | Decoy | Player;

// ---------- Projectiles ----------

export interface Homing {
  turnRate: number;
  acceleration: number;
  retargetRadius: number;
  /** Weaving flight: the heading swings ± amplitude around the pursuit line, from this missile's phase. */
  weave?: { amplitude: number; frequency: number; phase: number };
  /** Steers only once the shot's remaining life drops below this: a launch phase before homing. */
  armAt?: number;
  /** On losing its target, picks a random hostile nearby instead of the nearest, so a salvo fans out. */
  spread?: boolean;
}

interface ProjectileBase extends Hit {
  readonly team: Team;
  readonly splash: number;
  readonly splashDmg: number;
  x: number;
  y: number;
}

/** Anything that flies in a line (optionally homing) and hits what it touches. */
export interface FlyingShot extends ProjectileBase {
  readonly kind: 'bullet' | 'beam' | 'missile' | 'shell';
  vx: number;
  vy: number;
  readonly dmg: number;
  life: number;
  /** Hit radius. */
  readonly r: number;
  /** Units it can still pass through. */
  pierce: number;
  /** Ids already hit (piercing shots). */
  hits: number[] | null;
  readonly homing: Homing | null;
  target: Unit | null;
  readonly maxSpeed: number;
}

/** A lobbed shell that lands at a fixed point after a fixed time. `x`, `y` follow its ground point. */
export interface LobbedShot extends ProjectileBase {
  readonly kind: 'mortar';
  readonly sx: number;
  readonly sy: number;
  readonly tx: number;
  readonly ty: number;
  t: number;
  readonly flight: number;
}

export type Projectile = FlyingShot | LobbedShot;
export type ProjectileKind = Projectile['kind'];
/** The projectile type for a kind (several kinds share FlyingShot). */
export type ShotOfKind<K extends ProjectileKind> = K extends LobbedShot['kind'] ? LobbedShot : FlyingShot;

// ---------- Visual effects ----------

/** Semantic color; the renderer maps it to the palette. `semiAce` is the enemy semi-aces' color. */
export type Tone = 'ally' | 'enemy' | 'semiAce' | 'ace' | 'accent' | 'tool';

interface EffectBase {
  x: number;
  y: number;
  t: number;
  readonly life: number;
}

export interface BoomEffect extends EffectBase {
  readonly type: 'boom';
  readonly r: number;
  readonly tone: Tone;
}

export interface DebrisEffect extends EffectBase {
  readonly type: 'debris';
  vx: number;
  vy: number;
  readonly s: number;
  readonly tone: Tone;
}

export interface SparkEffect extends EffectBase {
  readonly type: 'spark';
  readonly tone: Tone;
}

/** An instant beam line (Railgun, Beam lance). */
export interface RailEffect extends EffectBase {
  readonly type: 'rail';
  readonly x2: number;
  readonly y2: number;
  readonly tone: Tone;
  /** Peak line width. */
  readonly width: number;
}

export interface SlashEffect extends EffectBase {
  readonly type: 'slash';
  readonly a: number;
  /** Half the arc's angle (the saber's arcHalfAngle). */
  readonly half: number;
  readonly r: number;
  readonly tone: Tone;
}

export interface EmpEffect extends EffectBase {
  readonly type: 'emp';
  readonly r: number;
}

export interface GhostEffect extends EffectBase {
  readonly type: 'ghost';
}

/** What one of the ace's hits did against a unit's defenses. */
export type HitResult = 'critical' | 'resisted' | 'shielded';

/** Marks an ace hit that armor made stronger (critical) or weaker (resisted), or a shield absorbed. */
export interface HitMarkerEffect extends EffectBase {
  readonly type: 'hitMarker';
  readonly result: HitResult;
  /** The hit's damage type (it colors a critical label); null if untyped. */
  readonly dtype: string | null;
  /** Also shows a rising text label (at most one per unit every so often). */
  readonly label: boolean;
}

export type Effect =
  | BoomEffect
  | DebrisEffect
  | SparkEffect
  | RailEffect
  | SlashEffect
  | EmpEffect
  | GhostEffect
  | HitMarkerEffect;
export type EffectType = Effect['type'];

/** A semi-ace (an elite class with its own color and the ace's damage bonus). */
export function isSemiAce(u: Unit): boolean {
  return u.kind === 'soldier' && u.def.semiAce === true;
}

/** The color a unit is drawn in (and its wreckage, slashes and beams): its team's, or its semi-ace color. */
export function unitTone(u: Unit): Tone {
  return toneOf(u.team, 'army', isSemiAce(u));
}

/** A hit from one of the ace's weapons. */
export function aceHit(w: { readonly id: string; readonly damageType: string }): Hit {
  return { src: 'player', wid: w.id, dtype: w.damageType };
}

/** A hit from an AI unit's weapon. */
export function armyHit(u: Soldier, w: { readonly damageType: string }): Hit {
  return { src: 'army', wid: null, dtype: w.damageType, semiAce: u.def.semiAce === true };
}

/** Whether a hit can land on the unit at all (the ace dodges everything while invulnerable). */
export function canBeHit(u: Unit): boolean {
  return u.alive && !(u.kind === 'player' && u.iframes > 0);
}

/** The color of a team's unit or fire: the ace's in accent, an enemy semi-ace's in its own color. */
export function toneOf(team: Team, src: DamageSource, semiAce = false): Tone {
  if (src === 'player') return 'accent';
  if (semiAce && team === ENEMY) return 'semiAce';
  return team === ALLY ? 'ally' : 'enemy';
}
