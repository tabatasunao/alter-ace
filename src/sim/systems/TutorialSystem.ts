import { clamp } from '../../core/math';
import type { TutorialStage } from '../../data/types';
import { ENEMY, type Player, type Soldier } from '../entities';
import { msg } from '../messages';
import { recenterOffset, shiftWorld } from '../recenter';
import { chargeRelease } from '../releaseCharge';
import { groupOffset, spawnGroup } from '../spawning';
import { activePlayer, type System } from '../System';
import { currentStage, usedControl, type TutorialState } from '../tutorial';
import type { World } from '../World';

/**
 * Runs the tutorial mission one stage at a time: each stage deploys its enemies east of the ace
 * and shows its first ring, then waits until the ace has flown through every ring in order, used
 * the stage's control, scored the kills it asks for and destroyed the enemies. The next stage
 * follows after a short gap; clearing the last stage wins. Enemies destroyed before the other
 * goals are met redeploy after `respawnGap`, so there is always something to use them on.
 */
export class TutorialSystem implements System {
  update(world: World): void {
    const t = world.tutorial;
    const P = activePlayer(world);
    if (!t || !P) return;
    if (!t.begun) return this.begin(world, t);

    if (t.clearedAt >= 0) {
      if (world.t - t.clearedAt >= world.catalog.armies.tutorial.stageGap) {
        t.index++;
        t.begun = false;
      }
      return;
    }

    const stage = currentStage(t);
    if (t.marker && Math.hypot(P.x - t.marker.x, P.y - t.marker.y) <= t.marker.r) {
      t.reached++;
      t.marker = this.markerAt(world, t, stage, t.reached);
    }
    if (stage.use && !t.used) {
      const now = usedControl(world, P, t, stage.use);
      if (now && !t.inUse) t.uses++;
      t.inUse = now;
      t.used = t.uses >= (stage.useCount ?? 1);
    }
    this.countKills(world, P, t, stage);

    const groupDead = t.group.every((u) => !u.alive);
    if (groupDead && t.group.length > 0 && t.respawnAt < 0) t.wavesCleared++;
    const goalMet = !stage.kill || t.kills >= stage.kill.count;
    const done =
      t.reached >= (stage.markers?.length ?? 0) &&
      (!stage.use || t.used) &&
      goalMet &&
      (stage.kill?.endsStage || (t.wavesCleared >= (stage.spawn.length > 0 ? (stage.waves ?? 1) : 0) && groupDead));
    if (!done) {
      if (groupDead && t.group.length > 0) this.redeploy(world, t, stage);
      return;
    }
    if (stage.kill?.endsStage) this.withdraw(world, t, stage);

    t.clearedAt = world.t;
    world.events.emit('tutorialCleared', { index: t.index });
    if (t.index >= t.stages.length - 1) {
      world.endBattle(true, msg('banner.tutorialDone'));
    } else {
      world.banner(msg('banner.tutorialStep', { n: t.index + 1, total: t.stages.length }), 'good');
    }
  }

  /**
   * Starts the current stage: the battle shifts so the ace is near the middle of the battlefield
   * (no enemy is left, and on screen nothing moves), then the stage's first ring and enemies
   * deploy east of the ace, and the gauge fills if the stage asks.
   */
  private begin(world: World, t: TutorialState): void {
    const P = world.player!;
    const stage = currentStage(t);
    const { dx, dy } = recenterOffset(world, P.x, P.y, world.catalog.armies.tutorial.recenterStep);
    shiftWorld(world, dx, dy);
    Object.assign(t, {
      begun: true,
      clearedAt: -1,
      origin: { x: P.x, y: P.y },
      reached: 0,
      used: false,
      uses: 0,
      inUse: false,
      kills: 0,
      killsSeen: world.stats.kills,
      killsBy: { ...world.stats.killsBy },
      respawnAt: -1,
      startActive: P.active,
      startAim: world.aim.index,
      group: [],
      wavesCleared: 0,
      deployed: 0,
    });
    t.marker = this.markerAt(world, t, stage, 0);
    const n = this.deploy(world, t);
    world.stats.enemyQueue.splice(0, n);
    if (stage.fillRelease) chargeRelease(world, P, 1);
    world.events.emit('tutorialStage', { index: t.index });
  }

  /** The stage's ring number `i`, placed from where the ace began the stage, or null past the last. */
  private markerAt(world: World, t: TutorialState, stage: TutorialStage, i: number): TutorialState['marker'] {
    const m = stage.markers?.[i];
    if (!m) return null;
    const margin = world.catalog.armies.formation.edgeMargin;
    return {
      x: clamp(t.origin.x + m.dx, margin, world.width - margin),
      y: clamp(t.origin.y + m.dy, margin, world.height - margin),
      r: m.radius,
    };
  }

  /**
   * Counts the ace's new kills toward the stage's kill goal: only once the control has been used,
   * with `whileChanged` only while it still differs from the start, and with `damageType` only
   * kills by a weapon of that type (any weapon, if no hardpoint carries one).
   */
  private countKills(world: World, P: Player, t: TutorialState, stage: TutorialStage): void {
    const s = world.stats;
    if (s.kills === t.killsSeen) return;
    const before = t.killsBy;
    t.killsSeen = s.kills;
    t.killsBy = { ...s.killsBy };
    const goal = stage.kill;
    if (!goal || (stage.use && (!t.used || (goal.whileChanged && !usedControl(world, P, t, stage.use))))) return;
    const type = goal.damageType && P.slots.some((slot) => slot.def.damageType === goal.damageType) ? goal.damageType : null;
    for (const [wid, n] of Object.entries(s.killsBy)) {
      const fresh = n - (before[wid] ?? 0);
      if (fresh > 0 && (!type || world.catalog.weapon(wid).damageType === type)) t.kills += fresh;
    }
  }

  /**
   * The stage ended on its kill goal: the enemies still on the field withdraw (gone with a brief
   * pulse, no kill credit), and its waves not yet sent leave the reserve.
   */
  private withdraw(world: World, t: TutorialState, stage: TutorialStage): void {
    for (const u of t.group) {
      if (!u.alive) continue;
      u.alive = false;
      world.stats.enemyField--;
      world.addFx({ type: 'pulse', x: u.x, y: u.y, r: u.size * 1.6, t: 0, life: 0.35, tone: 'enemy' });
    }
    t.respawnAt = -1;
    const planned = (stage.waves ?? 1) * (stage.groups ?? 1) * stage.spawn.reduce((n, g) => n + g.count, 0);
    world.stats.enemyQueue.splice(0, Math.max(0, planned - Math.min(t.deployed, planned)));
  }

  /**
   * The stage's group is destroyed but the stage is not cleared: after a gap, the next wave deploys
   * from the reserve, or, once every wave is used up and a goal is still open, the same group again
   * (added to the enemy total).
   */
  private redeploy(world: World, t: TutorialState, stage: TutorialStage): void {
    if (t.respawnAt < 0) {
      t.respawnAt = world.t + world.catalog.armies.tutorial.respawnGap;
    } else if (world.t >= t.respawnAt) {
      t.respawnAt = -1;
      const n = this.deploy(world, t);
      if (t.wavesCleared < (stage.waves ?? 1)) world.stats.enemyQueue.splice(0, n);
      else world.stats.enemyTotal += n;
    }
  }

  /**
   * Deploys the current stage's wave east of the ace as `t.group`: `groups` blocks of its enemies,
   * beyond the east edge of the view (at least `spawnDistance` away). Returns how many.
   */
  private deploy(world: World, t: TutorialState): number {
    const P = world.player!;
    const stage = currentStage(t);
    const cfg = world.catalog.armies.tutorial;
    const ids = stage.spawn.flatMap((g) => Array.from({ length: g.count }, () => g.class));
    if (ids.length === 0) return 0;
    const margin = world.catalog.armies.formation.edgeMargin;
    const distance = Math.max(cfg.spawnDistance, t.viewWidth / 2 / world.camera.zoom + cfg.spawnOffscreen);
    const x = clamp(P.x + distance, margin, world.width - margin);
    const groups = stage.groups ?? 1;
    const before = world.units.length;
    for (let i = 0; i < groups; i++) spawnGroup(world, ids, ENEMY, x, P.y + groupOffset(i, groups, stage.groupSpacing ?? 0), -1, stage.spacing);
    t.group = world.units.slice(before) as Soldier[];
    t.deployed += t.group.length;
    world.stats.enemyField += t.group.length;
    return t.group.length;
  }
}
