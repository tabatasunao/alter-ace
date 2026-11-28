import { tm } from '../i18n';
import type { Message } from '../sim/messages';
import { escapeHtml, kbdHtml, setHtml } from './dom';

/** The tutorial objective on screen. The text may contain `{keys}`, where `keys` go as key caps. */
export interface Objective {
  /** 1-based stage number, and how many stages there are. */
  readonly step: number;
  readonly total: number;
  readonly text: Message;
  readonly keys: readonly string[];
  /** The stage is cleared: shown with a check mark until the next one. */
  readonly done: boolean;
}

/** Stands in for `{keys}` while the text is escaped, then becomes the key caps. */
const KEYS_MARK = '\u0001';

/** The tutorial's objective strip above the hardpoints: the stage number and one line of text. */
export class ObjectiveView {
  private shownStep = -1;

  constructor(private readonly el: HTMLElement) {}

  render(objective: Objective | null): void {
    if (!objective) {
      this.el.classList.remove('show', 'done');
      this.shownStep = -1;
      return;
    }
    const text = escapeHtml(tm({ ...objective.text, params: { ...objective.text.params, keys: KEYS_MARK } }));
    setHtml(
      this.el,
      `<span class="hk" aria-hidden="true"></span><span class="hs">${objective.step}/${objective.total}</span>${text.replace(KEYS_MARK, kbdHtml(objective.keys))}`,
    );
    this.el.classList.toggle('done', objective.done);
    if (this.shownStep !== objective.step) {
      this.shownStep = objective.step;
      this.el.classList.remove('show');
      void this.el.offsetWidth; // restart the entrance for a new stage
    }
    this.el.classList.add('show');
  }
}
