import { clamp } from '../core/math';
import type { Effect, Projectile, UnitAction } from '../sim/entities';
import type { World } from '../sim/World';
import { isSoundId, type PlayOptions, type SoundId, type SoundSink } from './sounds';

/** Positional sounds fade out over this many half view widths from the camera. */
const HEARING = 1.6;
/** How far a sound at the edge of the view pans. */
const PAN = 0.6;
/** Debris pieces from one death land in the same cell of this size: one sound per death. */
const DEATH_CELL = 30;

/** Where the player hears from: the camera, and half the view's width in world units. */
export interface Listener {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
}

/** Plays a sound at a point on the field: quieter and panned with distance from the camera, silent far off. */
type PlayAt = (id: SoundId, x: number, y: number, options?: PlayOptions) => void;

type EffectSounds = { readonly [K in Effect['type']]?: (f: Extract<Effect, { type: K }>, at: PlayAt) => void };

/** The sound a callout plays, by its message key. */
const CALLOUT_SOUNDS: Readonly<Record<string, SoundId>> = {
  'callout.dodge': 'dodge',
  'callout.clash': 'clash',
  'callout.fullArmsReady': 'fullArmsReady',
  'callout.kills': 'fullArmsEnd',
};

/**
 * Sounds for new effects, by effect type. The ace's own slugs, beams and slashes sound when its
 * weapon fires (weapons.json → `sound`); here only the enemy versions and the extras sound.
 */
const EFFECT_SOUNDS: EffectSounds = {
  boom: (f, at) => at('blast', f.x, f.y, { volume: clamp(f.r / 80, 0.35, 1), rate: clamp(1.25 - f.r / 200, 0.7, 1.2) }),
  smoke: (f, at) => at('blastBig', f.x, f.y),
  slug: (f, at) => f.full && at('railBoom', f.x, f.y),
  heavyBeam: (f, at) => f.tone !== 'ace' && at('megaBeam', f.x, f.y),
  line: (f, at) => f.tone !== 'ace' && at('lance', f.x, f.y),
  slash: (f, at) => f.tone !== 'ace' && at('saber', f.x, f.y),
  callout: (f, at) => {
    const id = CALLOUT_SOUNDS[f.msg.key];
    if (id) at(id, f.x, f.y);
  },
};

/**
 * The battle's sounds, worked out from the World each frame (it only reads it, like the
 * renderer): the ace's weapons, dash, Full Arms and hits; new effects (explosions, enemy beams,
 * callouts) and enemy fire near the camera; and a warning when a charged attack locks onto the
 * ace. Whatever was already there when a new battle appears stays silent.
 */
export class BattleAudio {
  private world: World | null = null;
  private seenFx = new WeakSet<Effect>();
  private seenShots = new WeakSet<Projectile>();
  private warned = new WeakSet<UnitAction>();
  private sinceShot: number[] = [];
  private dashing = false;
  private release = false;
  private hurtT = 0;

  constructor(private readonly sink: SoundSink) {}

  update(world: World, ear: Listener): void {
    if (world !== this.world) this.reset(world);
    const at: PlayAt = (id, x, y, o) => {
      const dx = x - ear.x;
      const near = 1 - Math.hypot(dx, y - ear.y) / (ear.halfWidth * HEARING);
      if (near > 0.05) this.sink.play(id, { ...o, volume: (o?.volume ?? 1) * near, pan: clamp(dx / ear.halfWidth, -1, 1) * PAN });
    };
    this.ace(world);
    this.effects(world, at);
    this.enemyFire(world, at);
    this.lockWarnings(world);
  }

  private reset(world: World): void {
    this.world = world;
    this.seenFx = new WeakSet(world.fx);
    this.seenShots = new WeakSet(world.shots);
    this.warned = new WeakSet();
    const P = world.player;
    this.sinceShot = P ? P.slots.map((s) => s.sinceShot) : [];
    this.dashing = !!P?.dash;
    this.release = !!P?.release;
    this.hurtT = P?.hurtT ?? 0;
  }

  /** A hardpoint that fired since the last frame (its time since the last shot went back down), a dash or Full Arms starting, a hit. */
  private ace(world: World): void {
    const P = world.player;
    if (!P) return;
    P.slots.forEach((s, i) => {
      const sound = s.def.sound;
      if (s.sinceShot < (this.sinceShot[i] ?? Infinity) && sound && isSoundId(sound)) this.sink.play(sound);
      this.sinceShot[i] = s.sinceShot;
    });
    if (P.dash && !this.dashing) this.sink.play('dash');
    if (P.release && !this.release) this.sink.play('fullArms');
    if (P.hurtT > this.hurtT) this.sink.play('aceHit', { volume: 0.5 + 0.5 * P.hurtK });
    this.dashing = !!P.dash;
    this.release = !!P.release;
    this.hurtT = P.hurtT;
  }

  private effects(world: World, at: PlayAt): void {
    const deaths = new Set<string>();
    for (const f of world.fx) {
      if (this.seenFx.has(f)) continue;
      this.seenFx.add(f);
      if (f.type === 'debris') {
        // A destroyed unit: its debris pieces start together, so one sound per cell.
        const cell = `${Math.round(f.x / DEATH_CELL)},${Math.round(f.y / DEATH_CELL)}`;
        if (!deaths.has(cell)) {
          deaths.add(cell);
          at('blast', f.x, f.y, { volume: 0.45, rate: 1.15 });
        }
        continue;
      }
      (EFFECT_SOUNDS[f.type] as ((e: Effect, at: PlayAt) => void) | undefined)?.(f, at);
    }
  }

  /** Enemy shots near the camera; allied fire stays quiet so the enemy's reads clearly. */
  private enemyFire(world: World, at: PlayAt): void {
    const P = world.player;
    for (const p of world.shots) {
      if (this.seenShots.has(p)) continue;
      this.seenShots.add(p);
      if (p.src === 'army' && P && p.team !== P.team) at(p.kind === 'missile' ? 'enemyMissiles' : 'enemyShot', p.x, p.y);
    }
  }

  /** A charged attack (lance, mega-beam, dash strike) locking onto the ace: once per attack. */
  private lockWarnings(world: World): void {
    const P = world.player;
    if (!P?.alive) return;
    for (const u of world.units) {
      const a = u.kind === 'soldier' ? u.action : null;
      const line = a?.sightLine;
      if (!a || !line?.locked || line.target !== P || this.warned.has(a)) continue;
      this.warned.add(a);
      this.sink.play('lockWarn');
    }
  }
}
