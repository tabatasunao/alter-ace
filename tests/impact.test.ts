import { describe, expect, it } from 'vitest';
import { aceHit, ALLY, ENEMY } from '../src/sim/entities';
import type { LanceUnitWeapon } from '../src/data/types';
import { lance } from '../src/sim/ai/weapons/behaviors/lance';
import { kick } from '../src/sim/impact';
import { battlePipeline } from '../src/sim/pipelines';
import { addSoldier, ARMY_HIT, arena, battle, loadTestCatalog, run } from './helpers';

const still = { read: () => ({ x: 0, y: 0 }) };

describe('impact: hit-stop, slow motion, shake and flash', () => {
  const catalog = loadTestCatalog();
  const im = catalog.battle.impact;
  const hitBy = (id: string) => aceHit(catalog.armament(id) as { id: string; damageType: string });

  it('hit-stop holds the battle while effects, the camera and the impact itself keep running', () => {
    const world = battle(catalog, 3);
    const sim = battlePipeline(still);
    run(world, sim, 0.5);
    const t = world.t;
    const positions = world.units.map((u) => [u.x, u.y]);
    world.addFx({ type: 'spark', x: 0, y: 0, t: 0, life: 1, tone: 'ally' });
    kick(world, im.release);
    expect(world.impact.freeze).toBe(im.release.freeze);
    sim.step(world, 0.0625);
    expect(world.t).toBe(t);
    expect(world.units.map((u) => [u.x, u.y])).toEqual(positions);
    expect(world.fx.at(-1)!.t).toBe(0.0625);
    expect(world.impact.freeze).toBeCloseTo(im.release.freeze - 0.0625);
    expect(world.impact.shake).toBeLessThan(im.release.shake);
    run(world, sim, 0.25);
    expect(world.t).toBeGreaterThan(t);
  });

  it('starts no new hit-stop within the gap after the last one, unless forced', () => {
    const world = arena(catalog);
    const sim = battlePipeline(still);
    kick(world, im.bigKill);
    run(world, sim, im.bigKill.freeze + 0.05);
    expect(world.impact.freeze).toBeLessThanOrEqual(0);
    kick(world, im.dodge);
    expect(world.impact.freeze).toBeLessThanOrEqual(0); // inside the gap
    kick(world, im.aceDeath, 1, true);
    expect(world.impact.freeze).toBe(im.aceDeath.freeze);
  });

  it('the ace’s destruction holds, flashes in the danger color, then runs in slow motion', () => {
    const world = arena(catalog);
    const sim = battlePipeline(still);
    world.combat.kill(world.player!, ARMY_HIT);
    expect(world.impact.freeze).toBe(im.aceDeath.freeze);
    expect(world.impact.slow).toBe(im.aceDeath.slow);
    expect(world.impact.flashDanger).toBe(true);
    run(world, sim, im.aceDeath.freeze + 0.05);
    world.addFx({ type: 'spark', x: 0, y: 0, t: 0, life: 5, tone: 'ally' });
    sim.step(world, 0.125);
    expect(world.fx.at(-1)!.t).toBeCloseTo(0.125 * im.aceDeath.slowScale);
  });

  it('every hit on the ace makes it jolt, pops a red ring, reddens the edges and shakes the view, scaled by damage', () => {
    const world = arena(catalog);
    const P = world.player!;
    const scale = catalog.battle.balance.aceDamageTaken;
    const h = im.aceHit;
    const taken = P.maxHp * h.fullShare * 0.25;
    world.combat.damage(P, taken / scale, ARMY_HIT);
    expect(P.hurtT).toBe(h.react);
    expect(P.hurtK).toBeCloseTo(0.25);
    expect(world.impact.shake).toBeCloseTo(h.shake * 0.25);
    expect(world.impact.hurt).toBeCloseTo((h.hurt ?? 0) * 0.25);
    expect(world.impact.freeze).toBe(0);
    expect(world.fx.some((f) => f.type === 'pulse' && f.tone === 'danger')).toBe(true);
  });

  it('a heavy hit on the ace also lands with hit-stop and a danger flash; a light one does not', () => {
    const world = arena(catalog);
    const P = world.player!;
    const scale = catalog.battle.balance.aceDamageTaken;
    world.combat.damage(P, 1, ARMY_HIT);
    expect(world.impact.freeze).toBe(0);
    expect(world.impact.flash).toBe(0);
    world.combat.damage(P, (P.maxHp * im.heavyHit.minShare) / scale + 1, ARMY_HIT);
    expect(world.impact.freeze).toBe(im.heavyHit.freeze);
    expect(world.impact.shake).toBe(im.heavyHit.shake);
    expect(world.impact.flashDanger).toBe(true);
    expect(world.impact.hurt).toBe(1);
  });

  it('the mega-beam discharges as a heavy beam that shakes the view when it passes near the ace; a Sentinel lance is a plain line', () => {
    const world = arena(catalog);
    const P = world.player!;
    P.iframes = 99; // watch the look and the shake, not the damage
    const fire = (weaponId: string, missBy: number) => {
      const u = addSoldier(world, 'sentinel', ENEMY, P.x + 400, P.y + missBy, weaponId);
      const target = { ...P, y: P.y + missBy } as typeof P; // aim parallel to the ace, missBy off
      lance.fire({ world, unit: u, weapon: u.weapon as LanceUnitWeapon, target });
      for (let i = 0; i < 200 && u.action; i++) if (u.action.step(1 / 60)) u.action = null;
    };
    fire('beamLance', 0);
    expect(world.fx.some((f) => f.type === 'rail')).toBe(true);
    expect(world.impact.shake).toBe(0); // too thin to shake
    const d = im.beam.range / 3;
    fire('megaBeam', d);
    expect(world.fx.some((f) => f.type === 'heavyBeam')).toBe(true);
    expect(world.impact.shake).toBeCloseTo(im.beam.shake * (1 - d / im.beam.range), 0);
  });

  it('the ace’s heavy hits make a unit judder; light hits and army hits do not', () => {
    const world = arena(catalog);
    const P = world.player!;
    const unit = () => {
      const u = addSoldier(world, 'bulwark', ENEMY, P.x + 200, P.y);
      u.hp = u.maxHp = 1e6;
      return u;
    };
    const heavy = unit();
    world.combat.damage(heavy, im.stagger.minDamage * 2, hitBy('beamRifle'));
    expect(heavy.stagger).toBe(im.stagger.time);
    const light = unit();
    world.combat.damage(light, 1, hitBy('rifle'));
    expect(light.stagger).toBe(0);
    const army = unit();
    world.combat.damage(army, 1e4, ARMY_HIT);
    expect(army.stagger).toBe(0);
  });

  it('a big blast near the ace shakes the screen, less with distance; a small or far one does not', () => {
    const world = arena(catalog);
    const P = world.player!;
    world.combat.explode(P.x + 2000, P.y, im.blast.minRadius + 10, 1, ALLY, ARMY_HIT);
    world.combat.explode(P.x + 50, P.y, im.blast.minRadius - 10, 1, ALLY, ARMY_HIT);
    expect(world.impact.shake).toBe(0);
    const d = im.blast.range / 4;
    world.combat.explode(P.x + d, P.y, im.blast.minRadius + 10, 1, ALLY, ARMY_HIT);
    expect(world.impact.shake).toBeCloseTo(im.blast.shake * (1 - d / im.blast.range));
    expect(world.fx.some((f) => f.type === 'flare')).toBe(true);
  });

  it('the ace destroying a Commander is a big kill; allies destroying one is not', () => {
    const world = arena(catalog);
    const P = world.player!;
    world.combat.kill(addSoldier(world, 'commander', ENEMY, P.x + 300, P.y), ARMY_HIT);
    expect(world.impact.freeze).toBe(0);
    world.combat.kill(addSoldier(world, 'commander', ENEMY, P.x + 300, P.y), hitBy('rifle'));
    expect(world.impact.freeze).toBe(im.bigKill.freeze);
    expect(world.fx.filter((f) => f.type === 'smoke')).toHaveLength(2); // a staged blast for each big wreck
  });
});
