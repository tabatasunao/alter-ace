import { isWeapon, type ArmamentDef, type DecoyTool, type FrameDef, type UnitClassDef } from '../data/types';
import { ALLY, ENEMY, type Decoy, type Player, type Slot, type Soldier, type Team } from './entities';
import type { World } from './World';

/** Creates units with fresh ids and the world's seeded randomness. */
export class UnitFactory {
  constructor(private readonly world: World) {}

  soldier(def: UnitClassDef, team: Team, x: number, y: number): Soldier {
    const r = this.world.random;
    const { ai, balance } = this.world.catalog.battle;
    const weapon = this.world.catalog.unitWeapon(team === ENEMY && def.enemyWeapon ? def.enemyWeapon : def.weapon);
    const id = this.world.nextId();
    // Property order matters: it fixes the order of random draws, and so replays.
    return {
      kind: 'soldier',
      id,
      def,
      weapon,
      action: null,
      shieldT: 0,
      shieldCd: 0,
      labelAt: -1,
      team,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      size: def.size,
      cd: r.next() * weapon.interval,
      retarget: r.next() * 0.5,
      target: null,
      strafe: r.next() < 0.5 ? -1 : 1,
      strafeT: r.range(ai.strafeMin, ai.strafeMax),
      stunT: 0,
      buffT: 0,
      buffMul: 1,
      flash: 0,
      alive: true,
      cell: 0,
      hunter: team === ENEMY && (!!def.huntsAce || r.next() < balance.aceAggro),
      stalking: false,
      leader: null,
      // Spread first pulses over one interval by id, so healers do not pulse in step.
      healT: def.heal ? (def.heal.interval * ((id % 10) + 1)) / 10 : 0,
      stagger: 0,
      exposedT: 0,
      exposedMul: 1,
    };
  }

  decoy(tool: DecoyTool, team: Team, x: number, y: number, hp = tool.hp, life = tool.life): Decoy {
    return {
      kind: 'decoy',
      id: this.world.nextId(),
      team,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      size: tool.size,
      alive: true,
      cell: 0,
      flash: 0,
      stunT: 0,
      life,
      pullRadius: tool.pullRadius,
    };
  }

  player(frame: FrameDef, armaments: readonly ArmamentDef[], x: number, y: number): Player {
    const slots: Slot[] = armaments.map((def) =>
      isWeapon(def)
        ? { kind: 'weapon', def, ammo: def.mag ?? Infinity, reloadT: 0, reloadTotal: 1, cd: 0, spin: 0, sinceShot: Infinity }
        : { kind: 'tool', def, cd: 0, cdTotal: 1 },
    );
    return {
      kind: 'player',
      id: this.world.nextId(),
      team: ALLY,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: frame.hp,
      maxHp: frame.hp,
      size: this.world.catalog.battle.player.size,
      alive: true,
      cell: 0,
      flash: 0,
      stunT: 0,
      frame,
      slots,
      active: Math.max(0, slots.findIndex((s) => s.kind === 'weapon')),
      facing: 0,
      iframes: 0,
      dashCd: 0,
      dodgeArmed: false,
      hurtT: 0,
      hurtK: 0,
      releaseCharge: 1,
      release: null,
      dash: null,
      lunge: null,
      statuses: [],
      lastHit: -99,
      reticle: null,
      input: { x: 0, y: 0 },
    };
  }
}
