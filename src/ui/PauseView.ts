import { byId } from './dom';

/** The pause card. */
export class PauseView {
  private readonly resume = byId<HTMLButtonElement>('btnResume');

  constructor(
    private readonly root: HTMLElement,
    actions: { onResume: () => void; onAbandon: () => void },
  ) {
    this.resume.addEventListener('click', actions.onResume);
    byId('btnAbandon').addEventListener('click', actions.onAbandon);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.resume.focus();
  }
}
