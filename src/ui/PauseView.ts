import type { KeyMap } from '../input/keymap';
import { byId, kbdHtml } from './dom';
import { controlGroups } from './controls';

/** The pause card: the main keys (from the current bindings), Resume, Restart, Options and Abandon. */
export class PauseView {
  private readonly resume = byId<HTMLButtonElement>('btnResume');
  private readonly keys = byId('pauseKeys');

  constructor(
    private readonly root: HTMLElement,
    actions: { onResume: () => void; onRestart: () => void; onOptions: () => void; onAbandon: () => void },
  ) {
    this.resume.addEventListener('click', actions.onResume);
    byId('btnRestart').addEventListener('click', actions.onRestart);
    byId('btnPauseOptions').addEventListener('click', actions.onOptions);
    byId('btnAbandon').addEventListener('click', actions.onAbandon);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.resume.focus();
  }

  /** Lists the main keys as currently bound. */
  setKeys(map: KeyMap, slotCount: number): void {
    this.keys.innerHTML = controlGroups(map, slotCount)
      .map((g) => `<dt>${kbdHtml(g.keys)}</dt><dd>${g.label}</dd>`)
      .join('');
  }
}
