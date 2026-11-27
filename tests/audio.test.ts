import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BattleAudio, type Listener } from '../src/audio/BattleAudio';
import { findMissingSounds } from '../src/audio/registryCheck';
import { MUSIC, SOUNDS, type PlayOptions, type SoundId, type SoundSink } from '../src/audio/sounds';
import { sanitizeSettings } from '../src/game/settings';
import { msg } from '../src/sim/messages';
import { ALLY, ENEMY, type SightLine, type UnitAction } from '../src/sim/entities';
import { addSoldier, arena, loadTestCatalog } from './helpers';

const root = fileURLToPath(new URL('..', import.meta.url));

class Recorder implements SoundSink {
  played: { id: SoundId; o?: PlayOptions }[] = [];
  play(id: SoundId, o?: PlayOptions): void {
    this.played.push({ id, o });
  }
  ids(): SoundId[] {
    return this.played.map((p) => p.id);
  }
}

describe('audio', () => {
  const catalog = loadTestCatalog();

  it('has a file for every sound and music track', () => {
    for (const [id, def] of Object.entries(SOUNDS)) for (const f of def.files) expect(existsSync(join(root, 'public/audio/sfx', `${f}.mp3`)), `${id}: ${f}`).toBe(true);
    for (const [id, def] of Object.entries(MUSIC)) expect(existsSync(join(root, 'public/audio/music', `${def.file}.mp3`)), id).toBe(true);
  });

  it('gives every weapon a known sound, and reports an unknown one', () => {
    expect(catalog.weapons.every((w) => w.sound)).toBe(true);
    expect(findMissingSounds(catalog)).toEqual([]);
    const broken = { weapons: [{ ...catalog.weapons[0]!, sound: 'kazoo' }] } as unknown as typeof catalog;
    expect(findMissingSounds(broken)).toEqual([`weapon "${catalog.weapons[0]!.id}": no sound "kazoo"`]);
  });

  it('keeps effect and music volume in 0–1, with defaults', () => {
    expect(sanitizeSettings({}, 4)).toMatchObject({ sfx: 0.8, music: 0.6 });
    expect(sanitizeSettings({ sfx: 2, music: -1 }, 4)).toMatchObject({ sfx: 1, music: 0 });
  });

  describe('battle sounds', () => {
    function setup() {
      const world = arena(catalog);
      const P = world.player!;
      const sink = new Recorder();
      const audio = new BattleAudio(sink);
      const ear: Listener = { x: P.x, y: P.y, halfWidth: 600 };
      audio.update(world, ear); // the first frame of a battle stays silent
      return { world, P, sink, audio, frame: () => audio.update(world, ear) };
    }

    it('starts silent, then plays a weapon when its hardpoint fires', () => {
      const { P, sink, frame } = setup();
      expect(sink.played).toEqual([]);
      frame();
      expect(sink.played).toEqual([]);
      P.slots[0]!.sinceShot = 0;
      frame();
      expect(sink.ids()).toEqual([P.slots[0]!.def.sound]);
    });

    it('plays a dash, Full Arms starting and a hit on the ace, each once', () => {
      const { P, sink, frame } = setup();
      P.dash = { vx: 1, vy: 0, t: 0, duration: 0.2 } as never;
      P.release = { elapsed: 0, duration: 3, killsAtStart: 0 };
      P.hurtT = 0.2;
      P.hurtK = 1;
      frame();
      frame();
      expect(sink.ids().sort()).toEqual(['aceHit', 'dash', 'fullArms']);
      expect(sink.played.find((p) => p.id === 'aceHit')!.o!.volume).toBe(1);
    });

    it('sounds new explosions, deaths and callouts by where they are, and not far away', () => {
      const { world, P, sink, frame } = setup();
      world.fx.push({ type: 'boom', x: P.x + 300, y: P.y, r: 40, t: 0, life: 0.3, tone: 'enemy' });
      world.fx.push({ type: 'boom', x: P.x + 5000, y: P.y, r: 40, t: 0, life: 0.3, tone: 'enemy' });
      for (let i = 0; i < 3; i++) world.fx.push({ type: 'debris', x: P.x - 100 + i, y: P.y, vx: 0, vy: 0, s: 2, tone: 'enemy', t: 0, life: 0.5 });
      world.fx.push({ type: 'callout', x: P.x, y: P.y, t: 0, life: 0.7, msg: msg('callout.dodge'), tone: 'accent', size: 14 });
      frame();
      frame();
      expect(sink.ids()).toEqual(['blast', 'blast', 'dodge']);
      expect(sink.played[0]!.o!.pan).toBeGreaterThan(0); // right of the camera
      expect(sink.played[1]!.o!.pan).toBeLessThan(0); // the debris, left
    });

    it('plays enemy fire near the camera, not allied fire', () => {
      const { world, P, sink, frame } = setup();
      const enemy = addSoldier(world, 'trooper', ENEMY, P.x + 200, P.y);
      const ally = addSoldier(world, 'trooper', ALLY, P.x - 200, P.y);
      const shot = (team: number, x: number) =>
        ({ kind: 'bullet', x, y: P.y, vx: 0, vy: 0, team, dmg: 1, life: 1, r: 2, pierce: 0, hits: null, splash: 0, splashDmg: 0, homing: null, target: null, maxSpeed: 0, knock: null, src: 'army', wid: null, dtype: null }) as never;
      world.shots.push(shot(enemy.team, enemy.x), shot(ally.team, ally.x));
      frame();
      expect(sink.ids()).toEqual(['enemyShot']);
    });

    it('warns once when a charged attack locks onto the ace', () => {
      const { world, P, sink, frame } = setup();
      const u = addSoldier(world, 'sentinel', ENEMY, P.x + 400, P.y);
      const line: SightLine = { angle: Math.PI, range: 800, locked: false, target: P, width: 5 };
      const action: UnitAction = { holdsAI: false, sightLine: line, step: () => false };
      u.action = action;
      frame();
      expect(sink.ids()).toEqual([]);
      (line as { locked: boolean }).locked = true;
      frame();
      frame();
      expect(sink.ids()).toEqual(['lockWarn']);
    });
  });
});
