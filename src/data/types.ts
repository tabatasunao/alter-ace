/**
 * Shapes of the tuning files in public/data/*.json.
 * Gameplay numbers live in those files; code reads them through the Catalog.
 *
 * Extension points are named by string fields that select a strategy in a registry:
 *   WeaponDef.behavior → src/sim/weapons/registry.ts (aim feedback: src/render/painters/weaponOverlays.ts)
 *   AimModeDef.strategy→ src/sim/targeting/aimStrategies.ts
 *   UnitClassDef.shape, enemyShape → src/render/painters/unitPainters.ts
 *   UnitWeaponDef.behavior → src/sim/ai/weapons/registry.ts
 *   MovementDef.model  → src/sim/movement/registry.ts
 */

// ---------- Frames ----------

/** The frame stats the player spends points on. */
export type FrameStat = 'speed' | 'hp' | 'reload' | 'fireRate' | 'dash';

/** Every frame stat, in the hangar's order. */
export const FRAME_STATS: readonly FrameStat[] = ['speed', 'hp', 'reload', 'fireRate', 'dash'];

/** Points on each stat (0 to `maxPerStat`). */
export type FrameBuild = Record<FrameStat, number>;

export interface FrameStatDef {
  label: string;
  /** The stat's value with no points and with `maxPerStat` points; points in between scale it linearly. */
  min: number;
  max: number;
}

/**
 * The frame build (frames.json): `points` to spend, at most `maxPerStat` on one stat. `speed` is top
 * speed, `hp` max HP, `reload` the reload time multiplier, `fireRate` the time-between-shots
 * multiplier and `dash` the dash recharge in seconds.
 */
export interface FrameBuildData {
  points: number;
  maxPerStat: number;
  stats: Record<FrameStat, FrameStatDef>;
  presets: { name: string; build: FrameBuild }[];
}

/** A frame as the battle uses it, made from a build and the player's name for it (Catalog.frameFor). */
export interface FrameDef {
  name: string;
  speed: number;
  hp: number;
  /** Multiplies magazine reload time. */
  reloadMul: number;
  /** Multiplies the time between shots. */
  rateMul: number;
  /** Dash recharge in seconds. */
  dashCd: number;
}

// ---------- Damage types and armor ----------

export interface DamageTypeDef {
  id: string;
  name: string;
  /** What weapons of this type do best within their role (shown in the hangar). */
  trait: string;
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
  /** While this weapon is active the battle camera's zoom is multiplied by this (below 1 zooms out). */
  viewZoom?: number;
  /**
   * Time between shots at the ace's top speed, as a multiple of `interval` (1 at a standstill,
   * linear between): below 1, the weapon fires faster on the move.
   */
  movingFireInterval?: number;
  /** Time between shots while Full Arms runs, as a multiple of `interval` (0.5 = twice as fast). Default 1. */
  fullArmsFireInterval?: number;
  /** Camera zoom while the ace lunges with this weapon, as a multiple (it holds for `camera.swingHold` after). Default 1. */
  swingZoom?: number;
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

/**
 * Steady aim: the shot's damage multiplier falls linearly from `still` (at rest) to `moving` (at top
 * speed). Under `fullBelow` of top speed the shot is at full strength: `still` × `fullBonus`.
 */
export interface SteadyAim {
  still: number;
  moving: number;
  /** Speed share (0–1) under which the shot is at full strength. */
  fullBelow: number;
  fullBonus: number;
}

export interface RailWeapon extends WeaponBase {
  behavior: 'rail';
  hitWidth: number;
  /** Steady aim: damage by the ace's speed, with a full-strength bonus near rest. */
  steady?: SteadyAim;
}

/**
 * A spread of `pellets` every shot (Shotgun), each speed varied by ± `speedJitter`. A pellet that
 * hits an enemy ALTER knocks it back at `knock.push`, slowing over `knock.time`. Each shot jolts
 * the ace `jolt.distance` back over `jolt.time`, then leaves it sliding back at `jolt.carry`.
 */
export interface ShotgunWeapon extends WeaponBase {
  behavior: 'shotgun';
  speed: number;
  spread: number;
  pellets: number;
  speedJitter: number;
  knock: Knock;
  jolt: { distance: number; time: number; carry: number };
}

/** A knockback: a push speed, slowing linearly to a stop over `time` s. */
export interface Knock {
  push: number;
  time: number;
}

/**
 * One target, one huge hit (Sniper Rifle): a sight line shows for the last `sight` s before each
 * shot, then a beam (`beamWidth`) strikes the target.
 */
export interface SniperWeapon extends WeaponBase {
  behavior: 'sniper';
  sight: number;
  beamWidth: number;
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
  /** In flight, the landing point moves toward where the target will be at up to this speed. */
  track: number;
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
  | ShotgunWeapon
  | SniperWeapon;

export type WeaponBehaviorName = WeaponDef['behavior'];

export interface WeaponsData {
  weapons: WeaponDef[];
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
  /** Multiplies this weapon's damage against AI units (not the ace). Default 1. */
  armyMul?: number;
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
  /**
   * Terminal correction: when a missile first comes within `range` of its target it stops weaving
   * and turns at `turnRate` for `time` seconds toward where the target is heading (`lead`: 0 = where
   * it is, 1 = full intercept), then flies straight on (no more homing).
   */
  terminal?: { range: number; turnRate: number; time: number; lead: number };
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
  /**
   * Dash strike at a target beyond `range`, up to `dash.range`: the unit stands for `windup`
   * seconds while a sight line tracks the target (frozen for the last `lock`), then dashes at
   * `speed` to where it pointed and slashes for `dmg`. Once per `cooldown` seconds.
   */
  dash?: { range: number; windup: number; lock: number; speed: number; dmg: number; cooldown: number };
  /** A hop straight back after every slash: `distance` covered in `time` seconds. */
  retreat?: { distance: number; time: number };
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
export type BeamLook = 'line' | 'heavyBeam';

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
  /** Replaces `shape` for units of this class in the enemy army. */
  enemyShape?: string;
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
  /**
   * Holds a place relative to its own front line, in whatever direction the fight faces. Against
   * the nearest hostile in sight, its depth is its own distance to that hostile minus the nearest
   * teammate's (negative when it is ahead of them). It keeps the depth within `depth` ± `band`:
   * backing away from the hostile when too far forward, closing in when too far back.
   */
  holdLine?: { depth: number; band: number };
  /**
   * Shoots the ace whenever it is within the weapon's range, otherwise the nearest hostile. Its
   * missiles also go for the ace first: they switch to it when it comes within their retarget radius.
   */
  aceFirst?: boolean;
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
  defaultLoadout: { name: string; build: FrameBuild; slots: string[]; aim: string; enemies: number };
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
     * Full Arms (Space): every weapon hardpoint fires at once for `duration` s. It opens with a burst: each weapon launches `openingBurst`
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
    /**
     * The launch at the start of a sortie: the camera starts at `zoom` × the battle zoom, and the
     * ace boosts east at `speed` × its top speed when the launch sequence ends.
     */
    launch: { speed: number; zoom: number };
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
    /** Seconds a weapon's `swingZoom` holds after a lunge ends. */
    swingHold: number;
    battleZoom: ZoomFit;
    demoZoom: ZoomFit;
  };
  alerts: { criticalHp: number; criticalReset: number; breakingAllies: number };
  timing: { maxFrameDt: number; resultDelay: number; demoResetDelay: number; bannerDuration: number };
}

/** How the release gauge (0–1) fills while no release is running. */
export interface ReleaseCharge {
  /** The gauge at sortie start, 0–1. */
  start: number;
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
  /** A full-strength Railgun shot (steady aim) hits. */
  railFull: ImpactDef;
  /** Each Shotgun shot. */
  shotgun: ImpactDef;
  /** The ace boosts off at the end of the launch sequence. */
  launch: ImpactDef;
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
  frames: FrameBuildData;
  damage: DamageData;
  weapons: WeaponsData;
  aimModes: AimModesData;
  unitWeapons: UnitWeaponsData;
  units: UnitsData;
  armies: ArmiesData;
  loadout: LoadoutData;
  battle: BattleData;
}
