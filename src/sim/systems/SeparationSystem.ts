import type { Unit } from '../entities';
import type { System } from '../System';
import type { World } from '../World';

/** Pushes overlapping units apart. The ace is immovable; it shoves others aside. */
export class SeparationSystem implements System {
  update(world: World): void {
    const gap = world.catalog.battle.ai.separationGap;
    const random = world.random;
    world.grid.forEachPairInCell((a, b) => push(a, b, gap, random.next.bind(random)));
  }
}

function push(a: Unit, b: Unit, gap: number, rand: () => number): void {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const min = (a.size + b.size) * 0.5 + gap;
  let d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  if (d2 < 0.01) {
    dx = rand() - 0.5;
    dy = rand() - 0.5;
    d2 = dx * dx + dy * dy;
  }
  const d = Math.sqrt(d2);
  const o = (min - d) / d;
  const anchoredA = a.kind !== 'soldier';
  const anchoredB = b.kind !== 'soldier';
  if (anchoredA && anchoredB) return;
  if (anchoredA) {
    b.x += dx * o;
    b.y += dy * o;
  } else if (anchoredB) {
    a.x -= dx * o;
    a.y -= dy * o;
  } else {
    a.x -= dx * o * 0.5;
    a.y -= dy * o * 0.5;
    b.x += dx * o * 0.5;
    b.y += dy * o * 0.5;
  }
}
