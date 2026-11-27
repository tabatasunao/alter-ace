import { clamp, type Point } from '../core/math';
import type { MoveInput } from '../sim/input';
import type { CommandSink } from './commands';
import type { KeyMap } from './keymap';

const ZOOM_STEP = 1.15;

/** Whether a key event comes from a control that handles Enter and Space itself. */
function onControl(target: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && target instanceof Element && !!target.closest('button, input, select, textarea, summary, a[href]');
}

/**
 * Keyboard: held movement keys feed MoveInput; other keys become commands through the current
 * key map. In the hangar, Enter or Space launches; after a sortie, any key shows the result, then
 * Space or Enter sorties again and Esc returns to the hangar.
 */
export class KeyboardInput implements MoveInput {
  private readonly held = new Set<string>();

  constructor(
    private readonly sink: CommandSink,
    private readonly keys: () => KeyMap,
    target: Window = window,
  ) {
    target.addEventListener('keydown', (e) => this.onKeyDown(e));
    target.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    target.addEventListener('blur', () => this.reset());
  }

  read(): Point {
    const map = this.keys();
    let x = 0;
    let y = 0;
    for (const k of this.held) {
      const m = map.move(k);
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  reset(): void {
    this.held.clear();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const mode = this.sink.inputMode();
    if (mode === 'options') return;
    const k = e.key.toLowerCase();
    if (mode === 'menu') {
      if ((k === 'enter' || k === ' ') && !e.repeat && !onControl(e.target)) {
        e.preventDefault();
        this.sink.confirm();
      }
      return;
    }
    if (mode === 'launch') {
      // Any key skips the launch sequence.
      if (!e.repeat) {
        e.preventDefault();
        this.sink.confirm();
      }
      return;
    }
    if (mode === 'ended') {
      if (e.repeat) return;
      e.preventDefault();
      if (k === 'escape') this.sink.back();
      else this.sink.confirm();
      return;
    }

    const map = this.keys();
    const action = map.action(k);
    if (action || map.aim(k) >= 0) e.preventDefault();
    if (action === 'pause') return this.sink.togglePause();
    if (mode === 'paused') return;
    if (map.move(k)) {
      this.held.add(k);
      return;
    }
    if (e.repeat) return;

    const slot = map.slot(k);
    if (slot >= 0) return this.sink.selectSlot(slot);
    const aim = map.aim(k);
    if (aim >= 0) return this.sink.setAimIndex(aim);
    switch (action) {
      case 'aimPrev':
        return this.sink.cycleAim(-1);
      case 'aimNext':
        return this.sink.cycleAim(1);
      case 'dash':
        return this.sink.dash();
      case 'release':
        return this.sink.superRelease();
      case 'reload':
        return this.sink.reload();
      case 'zoomIn':
        return this.sink.zoomBy(ZOOM_STEP);
      case 'zoomOut':
        return this.sink.zoomBy(1 / ZOOM_STEP);
    }
  }
}
