import { ENEMY, unitTone, type Hit, type Tone, type Unit } from './entities';
import { kick, slowMotion } from './impact';
import { chargeRelease } from './release';
import type { World } from './World';

/** A big explosion in stages: a flash, the fire, then smoke that takes over and drifts out. */
function bigBlast(world: World, x: number, y: number, r: number, life: number, tone: Tone): void {
  world.addFx({ type: 'flare', x, y, r: r * 0.6, t: 0, life: 0.12, tone });
  world.addFx({ type: 'boom', x, y, r, t: 0, life, tone });
  world.addFx({ type: 'smoke', x, y, r: r * 1.3, t: 0, life: life * 2.4 });
}

/** What a destroyed unit leaves behind: debris, and a staged blast for big units (and a bigger one for the ace). */
export function spawnWreck(world: World, u: Unit): void {
  const r = world.random;
  const tone = unitTone(u);
  const big = u.size > 14;
  for (let i = 0, n = big ? 6 : 3; i < n; i++) {
    world.addFx({ type: 'debris', x: u.x, y: u.y, vx: r.range(-130, 130), vy: r.range(-130, 130), s: r.range(2, 4.5), tone, t: 0, life: r.range(0.4, 0.8) });
  }
  if (big) bigBlast(world, u.x, u.y, u.size * 2.2, 0.4, tone);
  if (u.kind === 'player') bigBlast(world, u.x, u.y, 90, 0.7, 'ace');
}

/** What a death changes in the battle: army counts, the ace's kill credit, kill banners, and defeat. */
export function scoreDeath(world: World, u: Unit, { src, wid }: Hit): void {
  if (u.kind === 'decoy') return;
  const s = world.stats;
  if (u.team === ENEMY) {
    s.enemyField--;
    const byAce = src === 'player' && !!wid;
    if (byAce) {
      s.kills++;
      s.killsBy[wid] = (s.killsBy[wid] ?? 0) + 1;
      const P = world.player;
      if (P) {
        const c = world.catalog.battle.player.superRelease.charge;
        const close = Math.hypot(u.x - P.x, u.y - P.y) <= c.closeRadius;
        chargeRelease(world, P, c.perKill * (close ? c.closeKillMul : 1));
      }
    }
    if (u.kind === 'soldier' && u.def.killBanner) {
      world.banner(u.def.killBanner, 'good');
      if (byAce) kick(world, world.catalog.battle.impact.bigKill);
    }
  } else if (u.kind === 'player') {
    const death = world.catalog.battle.impact.aceDeath;
    kick(world, death, 1, true);
    slowMotion(world, death.slow, death.slowScale);
    world.endBattle(false);
  } else {
    s.allyAlive--;
  }
}
