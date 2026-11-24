import { describe, expect, it } from 'vitest';
import { ENEMY } from '../src/sim/entities';
import { pickTargets } from '../src/sim/targeting/pickTargets';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('aim modes', () => {
  const catalog = loadTestCatalog();
  const mode = (id: string) => catalog.aimModeIndex(id);

  function scene() {
    const world = arena(catalog);
    const P = world.player!;
    const near = addSoldier(world, 'trooper', ENEMY, P.x + 100, P.y);
    const far = addSoldier(world, 'trooper', ENEMY, P.x + 380, P.y);
    const weak = addSoldier(world, 'trooper', ENEMY, P.x, P.y + 200);
    weak.hp = 10;
    const boss = addSoldier(world, 'commander', ENEMY, P.x - 250, P.y);
    const outOfRange = addSoldier(world, 'commander', ENEMY, P.x + 900, P.y);
    return { world, P, near, far, weak, boss, outOfRange };
  }

  it('Closest, Furthest, Lowest HP and Strongest pick what their names say', () => {
    const { world, near, far, weak, boss } = scene();
    expect(pickTargets(world, mode('closest'), 400, 1)).toEqual([near]);
    expect(pickTargets(world, mode('furthest'), 400, 1)).toEqual([far]);
    expect(pickTargets(world, mode('weakest'), 400, 1)).toEqual([weak]);
    expect(pickTargets(world, mode('strongest'), 400, 1)).toEqual([boss]);
  });

  it('never picks targets outside the weapon range', () => {
    const { world, outOfRange } = scene();
    expect(pickTargets(world, mode('strongest'), 400, 10)).not.toContain(outOfRange);
  });

  it('Attacking me prefers units targeting the ace, else falls back to closest', () => {
    const { world, P, near, far } = scene();
    expect(pickTargets(world, mode('attackers'), 400, 1)).toEqual([near]);
    far.target = P;
    expect(pickTargets(world, mode('attackers'), 400, 1)).toEqual([far]);
  });

  it('Densest pack picks a unit in the biggest group', () => {
    const { world, P, near } = scene();
    const pack = [0, 1, 2, 3, 4].map((i) => addSoldier(world, 'trooper', ENEMY, P.x - 100 + i * 12, P.y - 300));
    const pick = pickTargets(world, mode('cluster'), 400, 1)[0];
    expect(pack).toContain(pick);
    expect(pick).not.toBe(near);
  });

  it('returns the top k in rank order for salvos', () => {
    const { world, near, weak, boss } = scene();
    expect(pickTargets(world, mode('closest'), 400, 3)).toEqual([near, weak, boss]);
  });
});
