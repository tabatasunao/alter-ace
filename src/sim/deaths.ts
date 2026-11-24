import { ENEMY, unitTone, type Hit, type Unit } from './entities';
import type { World } from './World';

/** What a destroyed unit leaves behind: debris, and a blast for big units (and a bigger one for the ace). */
export function spawnWreck(world: World, u: Unit): void {
  const r = world.random;
  const tone = unitTone(u);
  const big = u.size > 14;
  for (let i = 0, n = big ? 6 : 3; i < n; i++) {
    world.addFx({ type: 'debris', x: u.x, y: u.y, vx: r.range(-130, 130), vy: r.range(-130, 130), s: r.range(2, 4.5), tone, t: 0, life: r.range(0.4, 0.8) });
  }
  if (big) world.addFx({ type: 'boom', x: u.x, y: u.y, r: u.size * 2.2, t: 0, life: 0.4, tone });
  if (u.kind === 'player') world.addFx({ type: 'boom', x: u.x, y: u.y, r: 90, t: 0, life: 0.7, tone: 'ace' });
}

/** What a death changes in the battle: army counts, the ace's kill credit, kill banners, and defeat. */
export function scoreDeath(world: World, u: Unit, { src, wid }: Hit): void {
  if (u.kind === 'decoy') return;
  const s = world.stats;
  if (u.team === ENEMY) {
    s.enemyField--;
    if (src === 'player' && wid) {
      s.kills++;
      s.killsBy[wid] = (s.killsBy[wid] ?? 0) + 1;
    }
    if (u.kind === 'soldier' && u.def.killBanner) world.banner(u.def.killBanner, 'good');
  } else if (u.kind === 'player') {
    world.endBattle(false);
  } else {
    s.allyAlive--;
  }
}
