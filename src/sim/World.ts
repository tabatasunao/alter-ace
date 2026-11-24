import { EventBus } from '../core/events';
import type { Point } from '../core/math';
import type { Random } from '../core/random';
import type { Catalog } from '../data/catalog';
import { Combat } from './Combat';
import type { Decoy, Effect, Player, Projectile, Unit } from './entities';
import type { BannerTone, GameEvents } from './events';
import { SpatialGrid } from './SpatialGrid';
import { UnitFactory } from './UnitFactory';

export type WorldMode = 'demo' | 'battle';

export interface BattleStats {
  enemyTotal: number;
  /** Enemies currently deployed and alive. */
  enemyField: number;
  /** Enemy classes still waiting to arrive. */
  enemyQueue: string[];
  reserveTimer: number;
  allyTotal: number;
  allyAlive: number;
  kills: number;
  killsBy: Record<string, number>;
  dmgTaken: number;
}

export interface BattleStatus {
  over: boolean;
  win: boolean;
  endAt: number;
  paused: boolean;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  zoomTarget: number;
}

/**
 * All state of one battle (or one hangar skirmish). Plain data plus a few services;
 * the behavior lives in systems (src/sim/systems) that run over it each step.
 */
export class World {
  /** Battle clock in seconds (only runs in battles). */
  t = 0;
  units: Unit[] = [];
  shots: Projectile[] = [];
  fx: Effect[] = [];
  decoys: Decoy[] = [];
  player: Player | null = null;

  readonly stats: BattleStats = {
    enemyTotal: 0,
    enemyField: 0,
    enemyQueue: [],
    reserveTimer: 0,
    allyTotal: 0,
    allyAlive: 0,
    kills: 0,
    killsBy: {},
    dmgTaken: 0,
  };
  readonly status: BattleStatus = { over: false, win: false, endAt: 0, paused: false };
  readonly camera: CameraState;
  readonly aim = { index: 0, timer: 0 };
  /** Average position of each team (index = Team), refreshed every step. */
  centroids: [Point | null, Point | null] = [null, null];

  readonly grid: SpatialGrid;
  readonly events = new EventBus<GameEvents>();
  readonly combat: Combat;
  readonly factory: UnitFactory;

  private lastId = 0;

  constructor(
    readonly catalog: Catalog,
    readonly random: Random,
    readonly mode: WorldMode,
  ) {
    const { width, height, cellSize } = catalog.battle.world;
    this.grid = new SpatialGrid(width, height, cellSize);
    this.camera = { x: width / 2, y: height / 2, zoom: 0.8, zoomTarget: 0.8 };
    this.combat = new Combat(this);
    this.factory = new UnitFactory(this);
  }

  get isDemo(): boolean {
    return this.mode === 'demo';
  }

  /** Enemies still to beat: on the field plus waiting in reserve. */
  get enemiesLeft(): number {
    return this.stats.enemyField + this.stats.enemyQueue.length;
  }

  get width(): number {
    return this.catalog.battle.world.width;
  }

  get height(): number {
    return this.catalog.battle.world.height;
  }

  nextId(): number {
    return ++this.lastId;
  }

  addShot(shot: Projectile): void {
    if (this.shots.length < this.catalog.battle.limits.maxShots) this.shots.push(shot);
  }

  addFx(effect: Effect): void {
    if (this.fx.length < this.catalog.battle.limits.maxEffects) this.fx.push(effect);
  }

  banner(text: string, tone: BannerTone = ''): void {
    this.events.emit('banner', { text, tone });
  }

  endBattle(win: boolean): void {
    if (this.status.over) return;
    this.status.over = true;
    this.status.win = win;
    this.status.endAt = this.t;
    this.banner(win ? 'Enemy army destroyed' : 'ALTER lost', win ? 'good' : 'warn');
    this.events.emit('battleEnded', { win });
  }
}
