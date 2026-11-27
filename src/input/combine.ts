import type { MoveInput } from '../sim/input';
import type { CommandSink } from './commands';

/** Sums several movement sources (keyboard + touch). */
export function combineMoveInputs(inputs: readonly MoveInput[]): MoveInput {
  return {
    read() {
      let x = 0;
      let y = 0;
      for (const input of inputs) {
        const p = input.read();
        x += p.x;
        y += p.y;
      }
      return { x, y };
    },
  };
}

/** Mouse wheel zooms the battle camera. */
export function bindWheelZoom(canvas: HTMLCanvasElement, sink: CommandSink): void {
  canvas.addEventListener(
    'wheel',
    (e) => {
      const mode = sink.inputMode();
      if (mode === 'menu' || mode === 'options') return;
      e.preventDefault();
      sink.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );
}
