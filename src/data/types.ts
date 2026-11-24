/**
 * Shapes of the tuning files in public/data/*.json.
 * Gameplay numbers live in those files; code reads them through the Catalog.
 *
 * Extension points are named by string fields that select a strategy in a registry:
 *   WeaponDef.behavior → src/sim/weapons/registry.ts
 *   ToolDef.effect     → src/sim/tools/registry.ts
 *   AimModeDef.strategy→ src/sim/targeting/aimStrategies.ts
 *   UnitClassDef.shape → src/render/painters/unitPainters.ts
 *   UnitWeaponDef.behavior → src/sim/ai/weapons/registry.ts
 *   MovementDef.model  → src/sim/movement/registry.ts
 */

// ---------- Frames ----------

export interface FrameDef {
  id: string;
  code: string;
  name: string;
  type: string;
  speed: number;
  hp: number;
  /** Multiplies magazine reload time. */
  reloadMul: number;
  /** Multiplies the time between shots. */
  rateMul: number;
  /** Multiplies tool recharge time. */
  toolMul: number;
  /** Dash recharge in seconds. */
  dashCd: number;
  desc: string;
}

export interface FramesData {
  frames: FrameDef[];
}

// ---------- Damage types and armor ----------

export interface DamageTypeDef {
  id: string;
  name: string;
}

/** How hard each damage type hits a unit class wearing this armor (1 = normal). */
export interface ArmorDef {
  id: string;
  name: string;
  /** Damage multiplier per damage type id; every type must be listed. */
  vs: Record<string, number>;
}

export interface DamageData {
  types: DamageTypeDef[];
  armor: ArmorDef[];
}

// ---------- Weapons ----------

interface WeaponBase {
  id: string;
  name: string;
  desc: string;
  /** Damage type id (damage.json); with the target's armor it scales every hit. */
  damageType: string;
  dmg: number;
  range: number;
  /** Seconds between shots (before the frame's rateMul). */
  interval: number;
  /** Rounds per magazine; null = unlimited. */
  mag: number | null;
  reload: number;
  /** Super release burst: the arc (degrees) around the ace's facing that its rounds spray into (default 360). */
  burstArc?: number;
}

export interface BulletWeapon extends WeaponBase {
  behavior: 'bullet';
  speed: number;
  spread: number;
  /** Units each round passes through, so one round can hit pierce + 1 (default 0). */
  pierce?: number;
}

export interface ScatterWeapon extends WeaponBase {
  behavior: 'scatter';
  speed: number;
  spread: number;
  pellets: number;
  speedJitter: number;
}

export interface BeamWeapon extends WeaponBase {
  behavior: 'beam';
  speed: number;
  pierce: number;
  radius: number;
}

export interface RailWeapon extends WeaponBase {
  behavior: 'rail';
  hitWidth: number;
}

export interface MissileWeapon extends WeaponBase {
  behavior: 'missile';
  /** Top speed once accelerated. */
  speed: number;
  launchSpeed: number;
  salvo: number;
  splash: number;
  splashDmg: number;
  life: number;
  fanAngle: number;
  /** Launch direction relative to the target, in radians: 0 = straight at it, π = straight back. */
  launchAngle: number;
  /** Seconds the missiles fly their launch direction before they start homing. */
  homingDelay: number;
  radius: number;
  turnRate: number;
  acceleration: number;
  retargetRadius: number;
}

export interface RocketWeapon extends WeaponBase {
  behavior: 'rocket';
  speed: number;
  splash: number;
  splashDmg: number;
  radius: number;
}

export interface MortarWeapon extends WeaponBase {
  behavior: 'mortar';
  splash: number;
  splashDmg: number;
  flight: number;
  leadFactor: number;
}

export interface SaberWeapon extends WeaponBase {
  behavior: 'saber';
  slash: number;
  arcHalfAngle: number;
  closeRange: number;
  lungeDuration: number;
  stopDistance: number;
  iframes: number;
}

export type WeaponDef =
  | BulletWeapon
  | ScatterWeapon
  | BeamWeapon
  | RailWeapon
  | MissileWeapon
  | RocketWeapon
  | MortarWeapon
  | SaberWeapon;

export type WeaponBehaviorName = WeaponDef['behavior'];

export interface WeaponsData {
  weapons: WeaponDef[];
}

// ---------- Tools ----------

interface ToolBase {
  id: string;
  name: string;
  desc: string;
  cooldown: number;
}

export interface RepairTool extends ToolBase {
  effect: 'repair';
  healFraction: number;
  duration: number;
}

export interface EmpTool extends ToolBase {
  effect: 'emp';
  radius: number;
  stun: number;
}

export interface DecoyTool extends ToolBase {
  effect: 'decoy';
  hp: number;
  life: number;
  size: number;
  pullRadius: number;
}

export interface OverboostTool extends ToolBase {
  effect: 'overboost';
  duration: number;
  speedMul: number;
  fireIntervalMul: number;
  damageTakenMul: number;
}

export type ToolDef = RepairTool | EmpTool | DecoyTool | OverboostTool;
export type ToolEffectName = ToolDef['effect'];

export interface ToolsData {
  tools: ToolDef[];
}

/** Anything that can go on a hardpoint. */
export type ArmamentDef = WeaponDef | ToolDef;

export function isWeapon(def: ArmamentDef): def is WeaponDef {
  return 'behavior' in def;
}

// ---------- Aim modes ----------

export interface AimModeDef {
  id: string;
  name: string;
  strategy: string;
  /** Keyboard shortcut (single character). */
  key: string;
  desc: string;
}

export interface AimModesData {
  /** Seconds between reticle re-picks. */
  reticleInterval: number;
  /** Order here is the Q/E cycle order. */
  modes: AimModeDef[];
}

// ---------- Unit weapons (AI units) ----------

interface UnitWeaponBase {
  id: string;
  name: string;
  /** Damage type id (damage.json); scales hits by the target unit's armor. */
  damageType: string;
  /** Damage per hit, before balance.unitVsUnit (against units) or aceDamageTaken (against the ace). */
  dmg: number;
  /** Fires at targets within this distance; the unit closes to about 82% of it. */
  range: number;
  /** Seconds between shots. */
  interval: number;
}

/** Fires `pellets` projectiles of kind `projectile`, aimed ahead of a moving target. */
export interface ShotUnitWeapon extends UnitWeaponBase {
  behavior: 'shot';
  /** Projectile kind: its look ("bullet", "beam") or a slower round ("shell"). */
  projectile: 'bullet' | 'beam' | 'shell';
  speed: number;
  /** Random ± angle per pellet (radians). */
  spread: number;
  /** How far ahead of a moving target to aim: 0 = at it, 1 = full lead. */
  lead: number;
  pellets?: number;
  /** Hit radius (default 2). */
  radius?: number;
  /** Extra units each shot passes through (default 0). */
  pierce?: number;
  splash?: number;
  splashDmg?: number;
}

/** A fanned salvo of homing missiles locked on the unit's target. */
export interface MissileUnitWeapon extends UnitWeaponBase {
  behavior: 'missile';
  salvo: number;
  speed: number;
  launchSpeed: number;
  life: number;
  fanAngle: number;
  radius: number;
  turnRate: number;
  acceleration: number;
  retargetRadius: number;
  splash: number;
  splashDmg: number;
  /**
   * Weaving flight: each missile's heading swings ± `amplitude` radians
   * around its pursuit line, `frequency` times a second, from its own random phase.
   */
  weave?: { amplitude: number; frequency: number };
  /** Launch direction relative to the target, in radians (default 0 = at it; π = straight back). */
  launchAngle?: number;
  /** Seconds the missiles fly their launch direction before they start homing (default 0). */
  homingDelay?: number;
}

/** Lunges at the target and slashes an arc on arrival (a semi-ace's beam saber). `range` is the lunge range. */
export interface SaberUnitWeapon extends UnitWeaponBase {
  behavior: 'saber';
  /** Slash reach from where the lunge ends. */
  slash: number;
  arcHalfAngle: number;
  /** Anything this close is hit wherever it is. */
  closeRange: number;
  lungeSpeed: number;
  /** Longest lunge in seconds. */
  maxLunge: number;
  /** Stops this far short of the target. */
  stopDistance: number;
}

/**
 * A charged beam: a sight line tracks the target for `charge` seconds, freezes for the last
 * `lock` seconds, then the beam hits everything on the line instantly.
 */
export interface LanceUnitWeapon extends UnitWeaponBase {
  behavior: 'lance';
  charge: number;
  lock: number;
  /** Extra hit width on each side of the line. */
  width: number;
  /** How far ahead of a moving target the line locks: 0 = at it, 1 = where it will be at release. */
  lead: number;
}

export type UnitWeaponDef = ShotUnitWeapon | MissileUnitWeapon | LanceUnitWeapon | SaberUnitWeapon;
export type UnitWeaponBehaviorName = UnitWeaponDef['behavior'];

export interface UnitWeaponsData {
  weapons: UnitWeaponDef[];
}

// ---------- Unit classes ----------

export interface UnitClassDef {
  id: string;
  name: string;
  shape: string;
  size: number;
  hp: number;
  speed: number;
  /** The class's one weapon: a unit weapon id from unitWeapons.json. */
  weapon: string;
  /** Used by the Strongest aim mode. */
  rank: number;
  /** Armor id (damage.json): how much each damage type hurts this class. */
  armor: string;
  /** Backs off when its target is closer than this. */
  kiteDistance?: number;
  /** Always goes after the ace when it is in range. */
  huntsAce?: boolean;
  /**
   * Enemy semi-aces: once a hunter with this field has found the ace (within aceHuntRange), it
   * stalks the ace anywhere, staying within this distance of it (on the player's screen).
   */
  nearAce?: number;
  /**
   * The pack a stalking enemy semi-ace rallies: when it starts stalking the ace, the nearest
   * `min`–`max` enemy units within `radius` join it. They hunt the ace with it, keeping within
   * `follow` of it, until it dies.
   */
  rally?: { min: number; max: number; radius: number; follow: number };
  aura?: { radius: number; fireRateMul: number };
  /**
   * A semi-ace's shield: the first hit once it is recharged raises it, and for `duration`
   * seconds nothing hurts the unit. Recharges for `cooldown` seconds. A stun drops it.
   */
  shield?: { duration: number; cooldown: number };
  /** A semi-ace: its hits count as the ace's against `aceHitMul`. */
  semiAce?: boolean;
  /** Multiplies damage this class takes from the ace and from semi-aces (normal ALTERs: 1.5). */
  aceHitMul?: number;
  /** How far ahead of its group's center this class deploys. */
  formationOffset: number;
  /** Banner shown when an enemy of this class dies. */
  killBanner?: string;
  blurb: string;
}

export interface UnitsData {
  classes: UnitClassDef[];
}

// ---------- Armies ----------

export type ArmyMix = Record<string, number>;

export interface ArmiesData {
  allyMix: ArmyMix;
  enemyMix: ArmyMix;
  /** Minimum count per class, whatever the army size. */
  minimums: Record<string, number>;
  /** Fills the rest of every army. */
  fillerClass: string;
  formation: { spacing: number; jitter: number; columnsFactor: number; edgeMargin: number };
  battle: {
    allies: { count: number; groups: number; x: number; groupSpacing: number };
    enemies: { initial: number; groups: number; x: number; xJitter: number; groupSpacing: number };
    playerStartX: number;
  };
  reinforcements: {
    battalion: number;
    interval: number;
    fieldThreshold: number;
    edgeOffset: number;
    yMargin: number;
  };
  demo: {
    allies: number;
    enemies: number;
    groups: number;
    allyX: number;
    enemyX: number;
    groupSpacing: number;
    cameraX: number;
  };
}

// ---------- Loadout ----------

export interface LoadoutData {
  slots: number;
  enemyCount: { min: number; max: number; step: number };
  defaultLoadout: { frame: string; slots: string[]; aim: string; enemies: number };
}

// ---------- Ace movement ----------

/** Direct steering: velocity eases toward input × top speed almost at once. */
export interface DirectMovement {
  model: 'direct';
  /** How fast velocity catches up with input (1/s); higher = snappier. */
  response: number;
}

/** Thrusters with inertia: input accelerates the ace, and it drifts when you let go. */
export interface ThrusterMovement {
  model: 'thruster';
  /** Seconds of full thrust from standstill to top speed. */
  thrustTime: number;
  /** Velocity decay rate while coasting (1/s); 0.6 ≈ halves every 1.2 s. */
  drag: number;
  /** Decay of sideways drift while thrusting (1/s); 0 = pure space physics. */
  lateralDrag: number;
  /** Share of top speed kept, in the dash direction, when a dash ends. */
  dashCarry: number;
}

export type MovementDef = DirectMovement | ThrusterMovement;
export type MovementModelName = MovementDef['model'];

// ---------- Battle rules and engine ----------

export interface ZoomFit {
  reference: number;
  aspect?: number;
  min: number;
  max: number;
}

export interface BattleData {
  world: { width: number; height: number; cellSize: number };
  limits: { maxShots: number; maxEffects: number };
  balance: {
    /** Scales damage AI units deal to each other (not to the ace). */
    unitVsUnit: number;
    /** Scales damage the ace takes. */
    aceDamageTaken: number;
    /** Chance an enemy unit hunts the ace. */
    aceAggro: number;
    aceHuntRange: number;
  };
  ai: {
    sightRange: number;
    retargetMin: number;
    retargetMax: number;
    approachFactor: number;
    strafeMin: number;
    strafeMax: number;
    strafeSpeed: number;
    steering: number;
    fireIntervalJitter: number;
    shotRangeFactor: number;
    auraBuffTime: number;
    separationGap: number;
    edgeMargin: number;
  };
  player: {
    size: number;
    /** How the ace responds to movement input; `model` picks the code (src/sim/movement/registry.ts). */
    movement: MovementDef;
    edgeMargin: number;
    regenDelay: number;
    regenPerSecond: number;
    dashDistance: number;
    dashDuration: number;
    dashIframes: number;
    /**
     * Super release (Space): every weapon hardpoint fires at once for `duration` s, then recharges for
     * `cooldown` s. It opens with a burst: each weapon launches `openingBurst` seconds' worth of its
     * fire at once in random directions (2.5 = 150% more than a second of fire).
     */
    superRelease: { duration: number; cooldown: number; openingBurst: number };
  };
  camera: {
    minZoom: number;
    maxZoom: number;
    followRate: number;
    demoFollowRate: number;
    zoomRate: number;
    battleZoom: ZoomFit;
    demoZoom: ZoomFit;
  };
  alerts: { criticalHp: number; criticalReset: number; breakingAllies: number };
  /** Highest first; the last entry should have minShare 0. */
  ranks: { letter: string; minShare: number }[];
  timing: { maxFrameDt: number; resultDelay: number; demoResetDelay: number; bannerDuration: number };
}

// ---------- Everything ----------

export interface GameData {
  frames: FramesData;
  damage: DamageData;
  weapons: WeaponsData;
  tools: ToolsData;
  aimModes: AimModesData;
  unitWeapons: UnitWeaponsData;
  units: UnitsData;
  armies: ArmiesData;
  loadout: LoadoutData;
  battle: BattleData;
}
