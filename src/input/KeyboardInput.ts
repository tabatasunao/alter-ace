import type { Point } from '../core/math';
import type { MoveInput } from '../sim/input';
import type { CommandSink, KeyBindings } from './commands';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const ZOOM_STEP = 1.15;

/** Keyboard: held movement keys feed MoveInput; other keys become commands. */
export class KeyboardInput implements MoveInput {
  private readonly held = new Set<string>();

  constructor(
    private readonly sink: CommandSink,
    private readonly bindings: () => KeyBindings,
    target: Window = window,
  ) {
    target.addEventListener('keydown', (e) => this.onKeyDown(e));
    target.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    target.addEventListener('blur', () => this.reset());
  }

  read(): Point {
    const h = this.held;
    return {
      x: (h.has('d') || h.has('arrowright') ? 1 : 0) - (h.has('a') || h.has('arrowleft') ? 1 : 0),
      y: (h.has('s') || h.has('arrowdown') ? 1 : 0) - (h.has('w') || h.has('arrowup') ? 1 : 0),
    };
  }

  reset(): void {
    this.held.clear();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const mode = this.sink.inputMode();
    if (mode === 'menu') return;
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k) || k === ' ') e.preventDefault();
    if (mode === 'ended') return;
    if (k === 'p' || k === 'escape') {
      e.preventDefault();
      this.sink.togglePause();
      return;
    }
    if (mode === 'paused') return;
    if (MOVE_KEYS.has(k)) {
      this.held.add(k);
      return;
    }
    if (e.repeat) return;

    const bindings = this.bindings();
    const slot = bindings.slotForKey(k);
    if (slot >= 0) return this.sink.selectSlot(slot);
    const aim = bindings.aimForKey(k);
    if (aim >= 0) return this.sink.setAimIndex(aim);
    switch (k) {
      case 'q':
        return this.sink.cycleAim(-1);
      case 'e':
        return this.sink.cycleAim(1);
      case 'shift':
        return this.sink.dash();
      case ' ':
        return this.sink.superRelease();
      case 'r':
        return this.sink.reload();
      case '=':
      case '+':
        return this.sink.zoomBy(ZOOM_STEP);
      case '-':
      case '_':
        return this.sink.zoomBy(1 / ZOOM_STEP);
    }
  }
}
