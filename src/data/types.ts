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
  /** Keeps firing during a dash (other weapons hold fire). */
  fireWhileDashing?: boolean;
  /**
   * Time between shots at the ace's top speed, as a multiple of `interval` (1 at a standstill,
   * linear between): below 1, the weapon fires faster on the move.
   */
  movingFireInterval?: number;
  /**
   * Spin-up: the fire rate rises from × `start` to × `top` over `upTime` s of continuous fire, and
   * falls back over `downTime` s once it stops (a dash or switching weapons stops it).
   */
  spin?: { start: number; top: number; upTime: number; downTime: number };
  /**
   * Heat instead of a magazine: `mag` is the shots to overheat and `reload` the overheat lockout.
   * Heat falls by `coolPerSecond` shots' worth per second once it has not fired for `coolDelay` s.
   */
  heat?: { coolPerSecond: number; coolDelay: number };
}

export interface BulletWeapon extends WeaponBase {
  behavior: 'bullet';
  speed: number;
  spread: number;
  /** Units each round passes through, so one round can hit pierce + 1 (default 0). */
  pierce?: number;
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
  /** Steady aim: damage × `still` when the ace is at a standstill, × `moving` at its top speed (linear between). */
  steady?: { still: number; moving: number };
}

/**
 * Pellets every shot, and every `blastEvery`-th shot of a magazine also a point-blank blast
 * (Breach Cannon): centered `blast.offset` in front, radius `blast.radius`, `blast.dmg` falling
 * off to half at the edge, knocking enemies away at `blast.push` (slowing over `blast.pushTime`)
 * and kicking the ace back at `recoil`.
 */
export interface BreachWeapon extends WeaponBase {
  behavior: 'breach';
  speed: number;
  spread: number;
  pellets: number;
  speedJitter: number;
  blastEvery: number;
  blast: { radius: number; offset: number; dmg: number; push: number; pushTime: number };
  recoil: number;
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

export interface MortarWeapon extends WeaponBase {
  behavior: 'mortar';
  splash: number;
  splashDmg: number;
  flight: number;
  leadFactor: number;
  /** The stun at the center of each landing (see StunSpec). */
  stun: StunSpec;
}

/**
 * A stun around a point: hostile units within `radius` (measured to their edge) are stunned for
 * `time` s and, while it lasts, are exposed: hits from the ace's side deal × `exposedMul`.
 */
export interface StunSpec {
  radius: number;
  time: number;
  exposedMul: number;
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
  | BeamWeapon
  | RailWeapon
  | MissileWeapon
  | MortarWeapon
  | SaberWeapon
  | BreachWeapon;

export type WeaponBehaviorName = WeaponDef['behavior'];

export interface WeaponsData {
  weapons: WeaponDef[];
}

// ---------- Tools ----------

interface ToolBase {
  id: string;
  name: string;
  desc: string;
  /** What the tool does during super release (shown on its card). */
  releaseDesc: string;
  cooldown: number;
}

/** During super release: heals `healFraction` of max HP over the release. */
export interface RepairTool extends ToolBase {
  effect: 'repair';
  healFraction: number;
  duration: number;
}

/** During super release: a burst at the start and every `releaseInterval` s. */
export interface EmpTool extends ToolBase {
  effect: 'emp';
  radius: number;
  stun: number;
  releaseInterval: number;
}

/**
 * During super release: an afterimage decoy at the ace's position at the start and every
 * `releaseInterval` s, with `releaseHp` HP for `releaseLife` s.
 */
export interface DecoyTool extends ToolBase {
  effect: 'decoy';
  hp: number;
  life: number;
  size: number;
  pullRadius: number;
  releaseInterval: number;
  releaseHp: number;
  releaseLife: number;
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
  /** How the discharge is drawn: a fading line (default) or a heavy beam with glow and a muzzle flare. */
  look?: BeamLook;
  /** Extra hit width on each side of the line. */
  width: number;
  /** How far ahead of a moving target the line locks: 0 = at it, 1 = where it will be at release. */
  lead: number;
}

/** The effect a line attack's discharge is drawn with (an `Effect` type). */
export type BeamLook = 'rail' | 'heavyBeam';

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
  /** Replaces `weapon` for units of this class in the enemy army. */
  enemyWeapon?: string;
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
   * Heal pulse: every `interval` seconds, units of the same army within `radius` (and the ace,
   * for an allied unit) regain `amount` of their max HP. A stun pauses the timer.
   */
  heal?: { interval: number; radius: number; amount: number };
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
  /** Weapon medals for career kills with one weapon, lowest first. */
  medals: { name: string; kills: number }[];
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
    /**
     * Close-quarters fire at the ace: within `range` of the ace, a unit's lead rises from its
     * weapon's `lead` toward `lead` (a weapon that leads more keeps its own), its spread narrows
     * toward × `spread`, and it fires up to `fireRate` times as often, all full at point blank.
     */
    closeAim: { range: number; lead: number; spread: number; fireRate: number };
    /**
     * Charged attacks (lances) aimed at the ace take turns: at most `max` charge at once, each fires
     * at least `gap` s after the one before, and a unit denied a turn tries again after `retry` s.
     */
    aceCharges: { max: number; gap: number; retry: number };
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
     * Super release (Space): every weapon hardpoint fires at once for `duration` s and every tool
     * hardpoint runs its release effect. It opens with a burst: each weapon launches `openingBurst`
     * seconds' worth of its fire at once in random directions (2.5 = 150% more than a second of fire).
     * The opening gives `openingIframes` s of invulnerability; for the whole release the ace takes
     * × `damageTakenMul` damage. It needs a full gauge (0–1), which `charge` fills.
     */
    superRelease: {
      duration: number;
      openingBurst: number;
      openingIframes: number;
      damageTakenMul: number;
      charge: ReleaseCharge;
    };
    /** A close dodge: an attack that touches the ace during a dash's invulnerability. Once per dash. */
    dodge: {
      /** Share of the frame's dash recharge given back (1 = dash ready again). */
      dashRefund: number;
      /** Release gauge gained. */
      releaseCharge: number;
    };
  };
  /** Hit-stop, screen shake and screen flash for big moments (see src/sim/impact.ts). */
  impact: ImpactData;
  /** How a won sortie is rated (src/game/rating.ts). */
  rating: RatingData;
  /**
   * Saber meets saber (src/sim/clash.ts): neither cuts, and both bounce apart. The ace is pushed
   * away at `acePush`; the enemy is knocked back at `unitPush`, slowing over `pushTime`.
   */
  clash: { acePush: number; unitPush: number; pushTime: number };
  /** Banners that praise the ace (PraiseSystem). */
  praise: {
    /** A banner every this many ace kills. */
    killMilestone: number;
    /** A banner when the ace downs `kills` enemies within `window` s; then quiet for `cooldown` s. */
    streak: { kills: number; window: number; cooldown: number };
    /** A banner when a super release ends with at least this many kills. */
    releaseMinKills: number;
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
  timing: { maxFrameDt: number; resultDelay: number; demoResetDelay: number; bannerDuration: number };
}

/** How the release gauge (0–1) fills while no release is running. */
export interface ReleaseCharge {
  /** Per enemy the ace destroys. */
  perKill: number;
  /** Kills within this distance of the ace count `closeKillMul` times. */
  closeRadius: number;
  closeKillMul: number;
  /** Per second, regardless of kills. */
  perSecond: number;
}

/**
 * One impact: `freeze` s of hit-stop (the simulation holds while effects keep playing), a screen
 * shake of `shake` CSS pixels that settles over `shakeTime` s, and a screen flash of `flash`
 * strength (0–1) over `flashTime` s. `danger` tints the flash with the danger color. `hurt` (0–1)
 * reddens the screen edges, fading over `hurtTime` s.
 */
export interface ImpactDef {
  freeze: number;
  shake: number;
  flash: number;
  danger?: boolean;
  hurt?: number;
}

export interface ImpactData {
  /** After a freeze, no new freeze starts for this many seconds (the ace's death excepted). */
  freezeGap: number;
  shakeTime: number;
  flashTime: number;
  hurtTime: number;
  /**
   * Any hit that lands on the ace, scaled by its damage (full at `fullShare` of max HP or more).
   * The ace also jolts and flashes for `react` s.
   */
  aceHit: ImpactDef & { fullShare: number; react: number };
  /** The ace destroys a class with `killBanner` (Commander, semi-ace). */
  bigKill: ImpactDef;
  /** One hit takes at least `minShare` of the ace's max HP. */
  heavyHit: ImpactDef & { minShare: number };
  /** Super release starts. */
  release: ImpactDef;
  /** A close dodge. */
  dodge: ImpactDef;
  /** The ace's saber meets an enemy saber. */
  clash: ImpactDef;
  /** One of the ace's melee slashes connects. */
  slash: ImpactDef;
  /** The ace is destroyed; then the battle runs at × `slowScale` speed for `slow` s. */
  aceDeath: ImpactDef & { slow: number; slowScale: number };
  /** A blast of at least `minRadius` within `range` of the ace; the shake fades with distance. */
  blast: ImpactDef & { minRadius: number; range: number };
  /** A hostile line attack at least `minWidth` wide passing within `range` of the ace; fades with distance. */
  beam: ImpactDef & { minWidth: number; range: number };
  /** One of the ace's hits that deals at least `minDamage` makes the unit judder for `time` s (visual). */
  stagger: { minDamage: number; time: number };
}

/**
 * A won sortie scores `pointsPerEnemy` per enemy in the army, times three factors:
 * pace (par time ÷ clear time, clamped), integrity (1 − `damagePerMaxHp` per max HP of damage
 * taken, floored) and the allied line (1 + `lineBonus` × share of allies alive).
 * The rank letter comes from the score per enemy.
 */
export interface RatingData {
  pointsPerEnemy: number;
  parSecondsPerEnemy: number;
  paceMin: number;
  paceMax: number;
  damagePerMaxHp: number;
  integrityMin: number;
  lineBonus: number;
  /** Highest first; the last entry should have minScore 0. */
  ranks: { letter: string; minScore: number }[];
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
