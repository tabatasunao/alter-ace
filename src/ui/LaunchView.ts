import type { FrameDef, FrameStat } from '../data/types';
import { t } from '../i18n';
import { byId, replayAnimation } from './dom';
import { statNumber } from './frameText';

/** What the launch sequence shows. */
export interface LaunchInfo {
  /** The ALTER: its player-given name and its frame stats. */
  readonly frame: FrameDef;
  /** The equipped weapons' names, in hardpoint order. */
  readonly gear: readonly string[];
}

/** The frame's stats as one line (English, like the rest of the sequence). */
function specLine(f: FrameDef): string {
  const n = (stat: FrameStat, v: number) => statNumber(stat, v) ?? '0%';
  return t('launch.spec', {
    speed: n('speed', f.speed),
    hp: n('hp', f.hp),
    reload: n('reload', f.reloadMul),
    rate: n('fireRate', f.rateMul),
    dash: n('dash', f.dashCd) + 's',
  });
}

/** The sequence's beats, in milliseconds from the start. */
const BEAT = { details: 1000, launch: 1700, out: 2250, done: 2550 };
/** After a skip, the fade-out takes this long. */
const SKIP_OUT_MS = 220;

/**
 * The launch sequence at the start of a sortie: letterbox bars close in, a link line types out,
 * the ALTER's name assembles letter by letter, its frame stats and weapons follow, then LAUNCH
 * flashes and the ace boosts off (`onLaunch`), and the overlay opens up (`onDone`). Any key or a
 * click skips to the launch.
 */
export class LaunchView {
  private timers: number[] = [];
  private launched = false;
  private onLaunch: (() => void) | null = null;
  private onDone: (() => void) | null = null;
  private readonly el = {
    link: byId('launchLink'),
    name: byId('launchName'),
    spec: byId('launchSpec'),
    gear: byId('launchGear'),
    go: byId('launchGo'),
    skip: byId('launchSkip'),
  };

  constructor(private readonly root: HTMLElement) {
    root.addEventListener('pointerdown', () => this.skip());
  }

  get running(): boolean {
    return this.onDone !== null;
  }

  play(info: LaunchInfo, onLaunch: () => void, onDone: () => void): void {
    this.clear();
    this.launched = false;
    this.onLaunch = onLaunch;
    this.onDone = onDone;
    this.el.link.textContent = t('launch.link');
    this.el.link.style.setProperty('--chars', String([...t('launch.link')].length));
    this.el.name.innerHTML = '';
    [...info.frame.name].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.setProperty('--i', String(i));
      this.el.name.appendChild(s);
    });
    this.el.spec.textContent = specLine(info.frame);
    this.el.gear.textContent = info.gear.join('  /  ');
    this.el.go.textContent = t('launch.go');
    this.el.skip.textContent = t('launch.skip');
    this.root.className = 'launch';
    this.root.hidden = false;
    replayAnimation(this.root, 'on');
    this.at(BEAT.details, () => this.root.classList.add('details'));
    this.at(BEAT.launch, () => this.fireLaunch());
    this.at(BEAT.out, () => this.root.classList.add('out'));
    this.at(BEAT.done, () => this.finish());
  }

  /** Jumps to the launch, then fades out quickly. */
  skip(): void {
    if (!this.running) return;
    this.clear();
    this.fireLaunch();
    this.root.classList.add('out');
    this.at(SKIP_OUT_MS, () => this.finish());
  }

  private fireLaunch(): void {
    if (this.launched) return;
    this.launched = true;
    this.root.classList.add('details', 'go');
    this.onLaunch?.();
  }

  private finish(): void {
    this.clear();
    this.root.hidden = true;
    this.root.className = 'launch';
    const done = this.onDone;
    this.onDone = this.onLaunch = null;
    done?.();
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clear(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }
}
