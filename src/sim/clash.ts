import { knockBack } from './ai/knockback';
import type { Player, Soldier, Unit } from './entities';
import { kick } from './impact';
import type { World } from './World';

/** Whether the ace has its Beam Saber out: the active hardpoint holds a saber. */
export function holdsBlade(P: Player): boolean {
  const slot = P.slots[P.active];
  return slot?.kind === 'weapon' && slot.def.behavior === 'saber';
}

/** Whether a unit is swinging a saber right now (a saber lunge in progress). */
export function swingingBlade(u: Unit): u is Soldier {
  return u.kind === 'soldier' && u.action?.blade === true;
}

/**
 * Saber meets saber (battle.json → clash): neither cuts. The ace bounces away and its lunge ends;
 * the enemy is knocked back the other way, losing its lunge. Sparks, a CLASH callout and a
 * hit-stop mark it.
 */
export function clash(world: World, P: Player, u: Soldier): void {
  const cfg = world.catalog.battle.clash;
  const d = Math.hypot(u.x - P.x, u.y - P.y) || 1;
  const nx = (u.x - P.x) / d;
  const ny = (u.y - P.y) / d;
  P.lunge = null;
  P.vx = -nx * cfg.acePush;
  P.vy = -ny * cfg.acePush;
  knockBack(world, u, nx * cfg.unitPush, ny * cfg.unitPush, cfg.pushTime);
  const mx = (P.x + u.x) / 2;
  const my = (P.y + u.y) / 2;
  world.addFx({ type: 'flare', x: mx, y: my, r: 20, t: 0, life: 0.14, tone: 'ace' });
  const r = world.random;
  for (let i = 0; i < 8; i++) {
    const a = Math.atan2(ny, nx) + Math.PI / 2 + (i % 2 ? Math.PI : 0) + r.range(-0.7, 0.7);
    const s = r.range(160, 320);
    world.addFx({ type: 'debris', x: mx, y: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, s: r.range(2, 3.5), tone: 'accent', t: 0, life: r.range(0.25, 0.45) });
  }
  world.addFx({ type: 'callout', x: mx, y: my - 22, t: 0, life: 0.6, text: 'CLASH', tone: 'accent', size: 15 });
  kick(world, world.catalog.battle.impact.clash);
}
