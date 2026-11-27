import { MUSIC, SOUNDS, type MusicId, type PlayOptions, type SoundId, type SoundSink } from './sounds';

/** Most sound effects playing at once, as a last guard (each sound also has its own limit, `voices`). */
const MAX_VOICES = 40;
/** The music level while the sortie is paused, as a share of normal. */
const DUCKED = 0.35;
/** Seconds the music takes to fade when it changes or stops. */
const MUSIC_FADE = 1.2;

interface Track {
  readonly id: MusicId;
  readonly gain: GainNode;
  readonly sources: AudioBufferSourceNode[];
  timer: number;
}

/**
 * Plays the game's sounds with Web Audio. Browsers block audio until the first click or key
 * press, so nothing plays before `unlock()`. Effects and music have their own volume (the
 * options); effects are panned, and each sound plays at most once per `gap` with at most `voices`
 * copies at once.
 * Looping music crossfades into its next repeat, so a track needs no seamless loop point.
 */
export class AudioEngine implements SoundSink {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckBus: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private readonly lastPlayed = new Map<SoundId, number>();
  private readonly playing = new Map<SoundId, number>();
  private voices = 0;
  private volumes = { sfx: 1, music: 1 };
  private track: Track | null = null;
  /** The music asked for before audio was unlocked. */
  private wanted: MusicId | null = null;

  constructor(private readonly baseUrl: string) {}

  /** Starts audio (call from a click or key press). Loads every sound effect. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.duckBus = ctx.createGain();
    this.sfxBus.connect(ctx.destination);
    this.duckBus.connect(this.musicBus).connect(ctx.destination);
    this.setVolumes(this.volumes.sfx, this.volumes.music);
    for (const def of Object.values(SOUNDS)) for (const f of def.files) void this.load(`sfx/${f}`);
    if (this.wanted) this.playMusic(this.wanted);
  }

  setVolumes(sfx: number, music: number): void {
    this.volumes = { sfx, music };
    if (!this.ctx) return;
    this.sfxBus!.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
    this.musicBus!.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
  }

  play(id: SoundId, o: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.voices >= MAX_VOICES) return;
    const def = SOUNDS[id];
    const now = ctx.currentTime;
    const copies = this.playing.get(id) ?? 0;
    if (copies >= def.voices || now - (this.lastPlayed.get(id) ?? -Infinity) < def.gap) return;
    const file = def.files[Math.floor(Math.random() * def.files.length)]!;
    const buffer = this.buffers.get(`sfx/${file}`);
    if (!buffer) return; // still loading
    this.lastPlayed.set(id, now);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = o.rate ?? 1;
    const gain = ctx.createGain();
    gain.gain.value = def.volume * (o.volume ?? 1);
    let out: AudioNode = gain;
    if (o.pan && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = o.pan;
      gain.connect(pan);
      out = pan;
    }
    source.connect(gain);
    out.connect(this.sfxBus!);
    this.voices++;
    this.playing.set(id, copies + 1);
    source.onended = () => {
      this.voices--;
      this.playing.set(id, (this.playing.get(id) ?? 1) - 1);
      out.disconnect();
    };
    source.start();
  }

  /** Switches the music, fading the old track out and the new one in; null for silence. */
  playMusic(id: MusicId | null): void {
    this.wanted = id;
    const ctx = this.ctx;
    if (!ctx || this.track?.id === id) return;
    this.stopTrack(MUSIC_FADE);
    if (!id) return;
    const def = MUSIC[id];
    void this.load(`music/${def.file}`).then((buffer) => {
      if (!buffer || this.wanted !== id || this.track?.id === id) return;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(def.volume, ctx.currentTime + MUSIC_FADE);
      gain.connect(this.duckBus!);
      const track: Track = { id, gain, sources: [], timer: 0 };
      this.track = track;
      this.queue(track, buffer, ctx.currentTime);
    });
  }

  /** Lowers the music while the sortie is paused. */
  duckMusic(on: boolean): void {
    if (this.ctx) this.duckBus!.gain.setTargetAtTime(on ? DUCKED : 1, this.ctx.currentTime, 0.1);
  }

  /** Pauses all audio (the tab is hidden). */
  suspend(): void {
    void this.ctx?.suspend();
  }

  /** Resumes audio after `suspend`, if it was unlocked. */
  resume(): void {
    void this.ctx?.resume();
  }

  /** Plays the buffer at `at`, and for a looping track schedules the next repeat to crossfade in. */
  private queue(track: Track, buffer: AudioBuffer, at: number): void {
    const ctx = this.ctx!;
    const def = MUSIC[track.id];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const fade = ctx.createGain();
    const xf = Math.min(def.crossfade, buffer.duration / 4);
    if (def.loop && track.sources.length > 0) {
      fade.gain.setValueAtTime(0, at);
      fade.gain.linearRampToValueAtTime(1, at + xf);
    }
    if (def.loop) {
      fade.gain.setValueAtTime(1, at + buffer.duration - xf);
      fade.gain.linearRampToValueAtTime(0, at + buffer.duration);
    }
    source.connect(fade).connect(track.gain);
    source.start(at);
    track.sources.push(source);
    source.onended = () => {
      track.sources.splice(track.sources.indexOf(source), 1);
      fade.disconnect();
    };
    if (!def.loop) return;
    const next = at + buffer.duration - xf;
    track.timer = window.setTimeout(() => {
      if (this.track === track) this.queue(track, buffer, Math.max(next, ctx.currentTime + 0.05));
    }, Math.max(0, (next - ctx.currentTime - 0.5) * 1000));
  }

  private stopTrack(fade: number): void {
    const track = this.track;
    const ctx = this.ctx;
    if (!track || !ctx) return;
    this.track = null;
    clearTimeout(track.timer);
    track.gain.gain.cancelScheduledValues(ctx.currentTime);
    track.gain.gain.setValueAtTime(track.gain.gain.value, ctx.currentTime);
    track.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    for (const s of track.sources) s.stop(ctx.currentTime + fade + 0.05);
  }

  private load(path: string): Promise<AudioBuffer | null> {
    let p = this.loading.get(path);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`${this.baseUrl}audio/${path}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          this.buffers.set(path, buffer);
          return buffer;
        })
        .catch((err: unknown) => {
          console.warn(`[audio] ${path}.mp3 could not be loaded`, err);
          return null;
        });
      this.loading.set(path, p);
    }
    return p;
  }
}
