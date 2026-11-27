import { describe, expect, it } from 'vitest';
import { launchShot } from '../src/sim/attacks';
import { ENEMY } from '../src/sim/entities';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { PlayerStatusSystem } from '../src/sim/systems/PlayerStatusSystem';
import { ProjectileSystem } from '../src/sim/systems/ProjectileSystem';
import { ARMY_HIT, arena, loadTestCatalog } from './helpers';
import { tm } from '../src/i18n';

describe('close dodge', () => {
  const catalog = loadTestCatalog();
  const cfg = catalog.battle.player.dodge;

  it('an attack that touches the ace mid-dash refunds the dash and charges the release gauge, once per dash', () => {
    const world = arena(catalog);
    const P = world.player!;
    P.releaseCharge = 0;
    const hp = P.hp;
    new PlayerCommands(world).dash();
    expect(P.dodgeArmed).toBe(true);
    world.combat.damage(P, 50, ARMY_HIT);
    expect(P.hp).toBe(hp);
    expect(world.stats.dodges).toBe(1);
    expect(P.dashCd).toBeCloseTo(Math.max(0, P.frame.dashCd * (1 - cfg.dashRefund)));
    expect(P.releaseCharge).toBeCloseTo(cfg.releaseCharge);
    expect(world.fx.some((f) => f.type === 'callout' && tm(f.msg) === 'DODGE')).toBe(true);
    expect(world.impact.freeze).toBe(catalog.battle.impact.dodge.freeze);
    world.combat.damage(P, 50, ARMY_HIT);
    expect(world.stats.dodges).toBe(1);
  });

  it('a shot passing through the dashing ace counts too', () => {
    const world = arena(catalog);
    const P = world.player!;
    new PlayerCommands(world).dash();
    P.dash = null; // hold still so the shot meets the ace
    launchShot(world, ENEMY, P.x + 40, P.y, Math.PI, ARMY_HIT, { kind: 'bullet', speed: 600, dmg: 5, life: 1, r: 2 });
    const projectiles = new ProjectileSystem();
    for (let i = 0; i < 12; i++) projectiles.update(world, 1 / 60);
    expect(world.stats.dodges).toBe(1);
  });

  it('needs a dash: super release invulnerability does not count, and the window closes with the dash’s invulnerability', () => {
    const world = arena(catalog);
    const P = world.player!;
    const commands = new PlayerCommands(world);
    commands.superRelease();
    world.combat.damage(P, 50, ARMY_HIT);
    expect(world.stats.dodges).toBe(0);

    const other = arena(catalog);
    const Q = other.player!;
    new PlayerCommands(other).dash();
    const status = new PlayerStatusSystem();
    for (let i = 0; i < Math.round((catalog.battle.player.dashIframes + 0.05) * 60); i++) status.update(other, 1 / 60);
    expect(Q.dodgeArmed).toBe(false);
    const hp = Q.hp;
    other.combat.damage(Q, 50, ARMY_HIT);
    expect(Q.hp).toBeLessThan(hp);
    expect(other.stats.dodges).toBe(0);
  });
});
