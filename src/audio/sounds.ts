/**
 * The game's sound effects and music, as files in public/audio. A sound with several files plays
 * one of them at random. `volume` balances the sounds against each other; `gap` is the shortest
 * time between two plays of the same sound, and `voices` the most copies of it playing at once (a
 * dense battle would otherwise stack dozens, and crowd out the sounds that matter).
 * Sources and licenses: public/licenses/AUDIO.md.
 */
export interface SoundDef {
  readonly files: readonly string[];
  readonly volume: number;
  readonly gap: number;
  readonly voices: number;
}

const sound = (files: string | readonly string[], volume: number, gap = 0.03, voices = 3): SoundDef => ({
  files: typeof files === 'string' ? [files] : files,
  volume,
  gap,
  voices,
});

export const SOUNDS = {
  // The ace's weapons (weapons.json → `sound`).
  bazooka: sound('bazooka', 0.75, 0.08),
  missile: sound('missile', 0.55, 0.08),
  rail: sound('rail', 0.8, 0.06),
  railBoom: sound('railBoom', 0.7, 0.2),
  sniper: sound('sniper', 0.8, 0.1),
  shotgun: sound('shotgun', 0.75, 0.08),
  saber: sound(['saber1', 'saber2'], 0.7, 0.08),
  // Explosions and hits.
  blast: sound(['blast1', 'blast2', 'blast3', 'blast4'], 0.5, 0.035, 6),
  blastBig: sound('blastBig', 0.85, 0.12),
  aceHit: sound(['aceHit1', 'aceHit2', 'aceHit3'], 0.6, 0.06),
  clash: sound('clash', 0.8, 0.1),
  // The ace's moves and Full Arms.
  dash: sound('dash', 0.5, 0.1),
  dodge: sound('dodge', 0.7, 0.15),
  fullArmsReady: sound('fullArmsReady', 0.6, 0.5),
  fullArms: sound('fullArms', 0.9, 0.5),
  fullArmsEnd: sound('fullArmsEnd', 0.6, 0.5),
  // Enemies.
  enemyShot: sound(['enemyShot1', 'enemyShot2', 'enemyShot3'], 0.22, 0.05, 3),
  enemyMissiles: sound('enemyMissiles', 0.35, 0.25, 2),
  lance: sound('lance', 0.55, 0.1),
  megaBeam: sound('megaBeam', 0.8, 0.3),
  lockWarn: sound('lockWarn', 0.55, 0.15),
  // Sortie flow.
  launchRumble: sound('launchRumble', 0.7, 0.5),
  launchGo: sound('launchGo', 0.85, 0.5),
  bannerGood: sound('bannerGood', 0.45, 0.3),
  bannerWarn: sound('bannerWarn', 0.5, 0.3),
  defeat: sound('defeat', 0.7, 1),
  // Interface.
  uiClick: sound('uiClick', 0.45, 0.04),
  uiSelect: sound('uiSelect', 0.45, 0.04),
  uiDeny: sound('uiDeny', 0.55, 0.1),
  uiConfirm: sound('uiConfirm', 0.6, 0.2),
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

export function isSoundId(id: string): id is SoundId {
  return id in SOUNDS;
}

/** A music file: whether it loops (crossfading each repeat over `crossfade` s) and its level. */
export interface MusicDef {
  readonly file: string;
  readonly loop: boolean;
  readonly crossfade: number;
  readonly volume: number;
}

export const MUSIC = {
  hangar: { file: 'hangar', loop: true, crossfade: 4, volume: 0.8 },
  battle: { file: 'battle', loop: true, crossfade: 2, volume: 0.55 },
  victory: { file: 'victory', loop: false, crossfade: 0, volume: 0.8 },
} satisfies Record<string, MusicDef>;

export type MusicId = keyof typeof MUSIC;

/** How a sound plays: a level (× its own), a stereo position (−1 left … 1 right) and a speed (pitch). */
export interface PlayOptions {
  readonly volume?: number;
  readonly pan?: number;
  readonly rate?: number;
}

/** Where game code sends sounds; AudioEngine plays them, tests record them. */
export interface SoundSink {
  play(id: SoundId, options?: PlayOptions): void;
}
