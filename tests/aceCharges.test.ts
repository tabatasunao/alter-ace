import { describe, expect, it } from 'vitest';
import type { LanceUnitWeapon, SaberWeapon } from '../src/data/types';
import { claimAceCharge } from '../src/sim/ai/aceCharges';
import { lance } from '../src/sim/ai/weapons/behaviors/lance';
import { ENEMY } from '../src/sim/entities';
import { chargeRelease } from '../src/sim/release';
import { SoldierAISystem } from '../src/sim/systems/SoldierAISystem';
import { saber } from '../src/sim/weapons/behaviors/saber';
import { addSoldier, arena, loadTestCatalog } from './helpers';

describe('turns for charged attacks on the ace', () => {
  const catalog = loadTestCatalog();
  const cfg = catalog.battle.ai.aceCharges;

  it('lets at most `max` units charge at the ace, spaces their shots, and gives a turn back when a holder stops', () => {
    const world = arena(catalog);
    const P = world.player!;
    const sentinels = Array.from({ length: cfg.max + 2 }, (_, i) => addSoldier(world, 'sentinel', ENEMY, P.x + 500, P.y + i * 40));
    const w = sentinels[0]!.weapon as LanceUnitWeapon;
    const results = sentinels.map((u) => lance.fire({ world, unit: u, weapon: w, target: P }));
    expect(results.filter((r) => r === true)).toHaveLength(cfg.max);
    expect(results.filter((r) => r === false)).toHaveLength(2);
    const fireTimes = sentinels.filter((u) => u.action).map((u) => (u.action as unknown as { remaining: number }).remaining);
    for (let i = 1; i < fireTimes.length; i++) expect(fireTimes[i]! - fireTimes[i - 1]!).toBeGreaterThanOrEqual(cfg.gap - 1e-9);

    sentinels[0]!.alive = false; // a holder dies: its turn frees up
    expect(lance.fire({ world, unit: sentinels.at(-1)!, weapon: w, target: P })).toBe(true);
  });

  it('a unit denied a turn holds fire and retries soon; charges at allies need no turn', () => {
    const world = arena(catalog);
    const P = world.player!;
    for (let i = 0; i < cfg.max; i++) {
      const holder = addSoldier(world, 'sentinel', ENEMY, P.x + 400, P.y + i * 30);
      expect(claimAceCharge(world, holder, 1)).not.toBeNull();
      // a holder keeps its turn while its charge at the ace runs
      holder.action = { holdsAI: false, sightLine: { angle: 0, range: 1, locked: false, target: P, width: 1 }, step: () => false };
    }
    const waiting = addSoldier(world, 'sentinel', ENEMY, P.x + 300, P.y - 60);
    waiting.cd = 0;
    waiting.target = P;
    waiting.retarget = 99;
    new SoldierAISystem().update(world, 1 / 60);
    expect(waiting.action).toBeNull();
    expect(waiting.cd).toBeCloseTo(cfg.retry);

    const ally = addSoldier(world, 'trooper', 0, P.x - 1500, P.y);
    const other = addSoldier(world, 'sentinel', ENEMY, ally.x + 300, ally.y);
    expect(lance.fire({ world, unit: other, weapon: other.weapon as LanceUnitWeapon, target: ally })).toBe(true);
  });
});

describe('beam saber and release charge feel', () => {
  const catalog = loadTestCatalog();

  it('a slash that connects lands with hit-stop; a whiff does not', () => {
    const world = arena(catalog, { slots: ['saber'] });
    const P = world.player!;
    const w = catalog.armament('saber') as SaberWeapon;
    const swing = () => {
      saber.fire({ world, player: P, weapon: w, targets: [{ ...P, x: P.x + 40 } as never], angle: 0 } as never);
      P.lunge!.onArrive();
      P.lunge = null;
    };
    swing();
    expect(world.impact.freeze).toBe(0);
    expect(world.fx.some((f) => f.type === 'slash')).toBe(true);
    const u = addSoldier(world, 'bulwark', ENEMY, P.x + 50, P.y);
    u.hp = u.maxHp = 1e6;
    swing();
    expect(world.impact.freeze).toBe(catalog.battle.impact.slash.freeze);
  });

  it('filling the release gauge sends a ping and a callout, once', () => {
    const world = arena(catalog);
    const P = world.player!;
    P.releaseCharge = 0.9;
    chargeRelease(world, P, 0.05);
    expect(world.fx.some((f) => f.type === 'callout')).toBe(false);
    chargeRelease(world, P, 0.1);
    expect(P.releaseCharge).toBe(1);
    expect(world.fx.filter((f) => f.type === 'callout' && f.text === 'RELEASE READY')).toHaveLength(1);
    expect(world.fx.some((f) => f.type === 'pulse' && f.tone === 'accent')).toBe(true);
    chargeRelease(world, P, 0.1);
    expect(world.fx.filter((f) => f.type === 'callout')).toHaveLength(1);
  });
});
