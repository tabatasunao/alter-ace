import type { TutorialStage, TutorialUse } from '../data/types';
import type { Player, Soldier } from './entities';
import type { World } from './World';

/** Where the tutorial mission stands. Read by the UI (objective) and the renderer (marker ring). */
export interface TutorialState {
  readonly stages: readonly TutorialStage[];
  /** The view's width in screen pixels when the mission began (enemies deploy beyond its edge). */
  viewWidth: number;
  /** The current stage (0-based). */
  index: number;
  /** Whether the current stage has deployed its enemies and first ring. */
  begun: boolean;
  /** Battle time the current stage was cleared, or -1 while it runs. */
  clearedAt: number;
  /** Where the ace was when the stage began; its rings are placed from here. */
  origin: { x: number; y: number };
  /** The ring to fly into now, or null. */
  marker: { x: number; y: number; r: number } | null;
  /** Rings flown through in this stage. */
  reached: number;
  /** The control is used (as often as the stage asks). */
  used: boolean;
  /** Separate uses of the control so far, and whether it was in use last step (a new use starts on the change). */
  uses: number;
  inUse: boolean;
  /** Kills toward the stage's kill goal. */
  kills: number;
  /** The ace's kill count, and kills per weapon, when last checked (new kills are counted against them). */
  killsSeen: number;
  killsBy: Record<string, number>;
  /** The current stage's enemies, and how many of its waves have been destroyed. */
  group: Soldier[];
  wavesCleared: number;
  /** Enemies the stage has deployed so far, over all its waves. */
  deployed: number;
  /** Battle time the enemies redeploy (destroyed before the stage's goals were met), or -1. */
  respawnAt: number;
  /** The hardpoint and aim mode when the stage began (a change counts as using them). */
  startActive: number;
  startAim: number;
}

export function newTutorialState(stages: readonly TutorialStage[]): TutorialState {
  return {
    stages,
    viewWidth: 0,
    index: 0,
    begun: false,
    clearedAt: -1,
    origin: { x: 0, y: 0 },
    marker: null,
    reached: 0,
    used: false,
    uses: 0,
    inUse: false,
    kills: 0,
    killsSeen: 0,
    killsBy: {},
    group: [],
    wavesCleared: 0,
    deployed: 0,
    respawnAt: -1,
    startActive: 0,
    startAim: 0,
  };
}

/** The stage on screen. */
export function currentStage(t: TutorialState): TutorialStage {
  return t.stages[Math.min(t.index, t.stages.length - 1)]!;
}

/** Whether `control` differs from how the stage began (for dash and Full Arms: is running now). */
export function usedControl(world: World, P: Player, t: TutorialState, control: TutorialUse): boolean {
  switch (control) {
    case 'weapons':
      return P.active !== t.startActive;
    case 'aim':
      return world.aim.index !== t.startAim;
    case 'dash':
      return P.dash !== null;
    case 'fullArms':
      return P.release !== null;
  }
}

/**
 * How far along the stage is, as a count: kills toward its kill goal when that asks for more than
 * one, or else enemies destroyed out of all its waves (the total grows if a group has to come
 * again), or else rings reached, or else uses of its control. Null when the stage has none of these.
 */
export function stageCount(t: TutorialState): { done: number; total: number } | null {
  const stage = currentStage(t);
  if (stage.kill && stage.kill.count > 1) return { done: Math.min(t.kills, stage.kill.count), total: stage.kill.count };
  if (stage.spawn.length > 0) {
    const perWave = (stage.groups ?? 1) * stage.spawn.reduce((n, g) => n + g.count, 0);
    const alive = t.group.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
    return { done: Math.max(0, t.deployed - alive), total: Math.max(perWave * (stage.waves ?? 1), t.deployed) };
  }
  const rings = stage.markers?.length ?? 0;
  if (rings > 0) return { done: Math.min(t.reached, rings), total: rings };
  if (stage.use) {
    const total = stage.useCount ?? 1;
    return { done: Math.min(t.uses, total), total };
  }
  return null;
}
