import type { Player } from './entities';
import { chargeRelease } from './releaseCharge';
import type { World } from './World';

/** Battle time of the last graze spark, per world (so a stream of grazes does not flood the screen). */
const lastMark = new WeakMap<World, number>();

/**
 * Enemy fire passed the ace `edge` units from its hull without touching it. Within the graze
 * radius it charges the Full Arms gauge (per shot or per line attack) and sparks on the ace.
 */
export function noteGraze(world: World, P: Player, edge: number, kind: 'shot' | 'line'): void {
  const g = world.catalog.battle.player.superRelease.charge.graze;
  if (edge > g.radius || !P.alive || world.status.over) return;
  chargeRelease(world, P, kind === 'line' ? g.perLine : g.perShot);
  if (world.t - (lastMark.get(world) ?? -Infinity) < g.markGap) return;
  lastMark.set(world, world.t);
  world.addFx({ type: 'pulse', x: P.x, y: P.y, r: P.size * 0.5 + g.radius * 0.6, t: 0, life: 0.18, tone: 'release' });
}
