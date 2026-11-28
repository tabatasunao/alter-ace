import { t } from '../i18n';
import { escapeHtml, setHtml } from './dom';

/** One key cap: what it shows, whether its key is held or was just pressed, and how far a recharging control has charged (null when ready). */
export interface KeyCap {
  readonly label: string;
  readonly on: boolean;
  readonly charge: number | null;
}

/** The tutorial's key prompt, in screen pixels just under the ace. */
export interface KeyPrompt {
  readonly x: number;
  readonly y: number;
  readonly caps: readonly KeyCap[];
  /** Movement keys go in a cross (up above left, down, right); others in a row. */
  readonly cross: boolean;
  /** The key the player last pressed, shown for a moment, and whether it is one of the caps. */
  readonly pressed: { readonly label: string; readonly match: boolean } | null;
}

/** The tutorial step's count over the ace (enemies destroyed, rings, dashes), in screen pixels. */
export interface StageCount {
  readonly x: number;
  readonly y: number;
  readonly done: number;
  readonly total: number;
}

/**
 * Big key caps next to the ace during the tutorial: the keys the stage asks for, lit while held or
 * just pressed, and under them the key the player last pressed. Over the ace, the step's count as
 * 00/00.
 */
export class KeyPromptView {
  private html = '';
  private count = '';

  constructor(
    private readonly el: HTMLElement,
    private readonly countEl: HTMLElement,
  ) {}

  /** The step's count, zero-padded to the same width on both sides (at least two digits). */
  renderCount(c: StageCount | null): void {
    if (!c) {
      this.countEl.classList.remove('show');
      return;
    }
    const width = Math.max(2, String(c.total).length);
    const text = `${String(c.done).padStart(width, '0')}/${String(c.total).padStart(width, '0')}`;
    if (text !== this.count) {
      this.count = text;
      this.countEl.textContent = text;
    }
    this.countEl.classList.toggle('done', c.done >= c.total);
    this.countEl.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px) translate(-50%, -100%)`;
    this.countEl.classList.add('show');
  }

  render(p: KeyPrompt | null): void {
    if (!p) {
      this.el.classList.remove('show');
      return;
    }
    const caps = p.caps
      .map((c) =>
        c.charge === null
          ? `<kbd class="kp-cap${c.on ? ' on' : ''}">${escapeHtml(c.label)}</kbd>`
          : `<kbd class="kp-cap charging" style="--charge:${Math.round(c.charge * 100)}%">${escapeHtml(c.label)}</kbd>`,
      )
      .join('');
    const pressed = p.pressed
      ? `<span class="kp-pressed${p.pressed.match ? ' match' : ''}">${escapeHtml(t('hud.pressed'))} <kbd>${escapeHtml(p.pressed.label)}</kbd></span>`
      : '';
    const html = `<span class="kp-keys${p.cross ? ' cross' : ''}">${caps}</span>${pressed}`;
    if (html !== this.html) {
      this.html = html;
      setHtml(this.el, html);
    }
    this.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translateX(-50%)`;
    this.el.classList.add('show');
  }
}
