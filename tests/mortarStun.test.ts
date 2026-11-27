import { describe, expect, it } from 'vitest';
import type { MortarWeapon } from '../src/data/types';
import { aceHit, ALLY, ENEMY } from '../src/sim/entities';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { ShieldSystem } from '../src/sim/systems/ShieldSystem';
import { mortar } from '../src/sim/weapons/behaviors/mortar';
import { addSoldier, ARMY_HIT, arena, loadFixtureCatalog } from './helpers';

describe('mortar stun (test weapon)', () => {
  const catalog = loadFixtureCatalog();
  const w = catalog.weapon('mortar') as MortarWeapon;

  function landShell() {
    const world = arena(catalog, { slots: ['mortar'] });
    const P = world.player!;
    const spot = { x: P.x + 300, y: P.y };
    const center = addSoldier(world, 'trooper', ENEMY, spot.x, spot.y);
    const rim = addSoldier(world, 'trooper', ENEMY, spot.x + w.stun.radius + 40, spot.y);
    const semi = addSoldier(world, 'marksman', ENEMY, spot.x, spot.y + 20);
    for (const u of [center, rim, semi]) u.hp = u.maxHp = 1e6;
    semi.shieldT = 1;
    mortar.fire({ world, player: P, weapon: w, targets: [{ ...center, vx: 0, vy: 0 } as never], angle: 0, ammo: 2 });
    const projectiles = new ProjectileSystem();
    for (let i = 0; i < Math.ceil(w.flight * 60) + 2; i++) projectiles.update(world, 1 / 60);
    return { world, center, rim, semi };
  }

  it('stuns and exposes enemies at the center of the landing, not at the rim, and shows the shockwave', () => {
    const { world, center, rim } = landShell();
    expect(center.stunT).toBe(w.stun.time);
    expect(center.exposedT).toBe(w.stun.time);
    expect(rim.stunT).toBe(0);
    expect(rim.exposedT).toBe(0);
    expect(world.fx.some((f) => f.type === 'emp' && f.r === w.stun.radius)).toBe(true);
  });

  it('exposed enemies take × exposedMul from the ace and from allied units, marked EXPOSED on the ace’s hits', () => {
    const { world, center, rim } = landShell();
    const hit = aceHit(w);
    center.flash = rim.flash = 0; // let the blast's hit flash end so the next hit can be marked
    const before = { center: center.hp, rim: rim.hp };
    world.combat.damage(center, 100, hit);
    world.combat.damage(rim, 100, hit);
    expect(before.center - center.hp).toBeCloseTo((before.rim - rim.hp) * w.stun.exposedMul);
    expect(world.fx.some((f) => f.type === 'hitMarker' && f.result === 'exposed')).toBe(true);

    const c = center.hp;
    const r = rim.hp;
    world.combat.damage(center, 100, ARMY_HIT); // an allied unit's hit
    world.combat.damage(rim, 100, ARMY_HIT);
    expect(c - center.hp).toBeCloseTo((r - rim.hp) * w.stun.exposedMul);
    expect(ALLY).not.toBe(ENEMY);
  });

  it('drops a semi-ace’s raised shield through the stun', () => {
    const { world, semi } = landShell();
    expect(semi.stunT).toBeGreaterThan(0);
    new ShieldSystem().update(world, 1 / 60);
    expect(semi.shieldT).toBeLessThanOrEqual(0);
    const hp = semi.hp;
    world.combat.damage(semi, 50, aceHit(w));
    expect(semi.hp).toBeLessThan(hp); // a stunned unit's shield cannot block
  });
});
