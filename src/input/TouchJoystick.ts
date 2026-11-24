import type { Point } from '../core/math';
import type { JoystickView } from '../render/layers/JoystickLayer';
import type { MoveInput } from '../sim/input';

const RADIUS = 56;

/** A floating joystick that appears wherever a finger touches the battlefield. Ignores the mouse. */
export class TouchJoystick implements MoveInput, JoystickView {
  active = false;
  ox = 0;
  oy = 0;
  x = 0;
  y = 0;
  private pointerId: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly canStart: () => boolean,
    private readonly onTouch: () => void,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onEnd(e));
    canvas.addEventListener('pointercancel', (e) => this.onEnd(e));
  }

  read(): Point {
    return { x: this.x, y: this.y };
  }

  reset(): void {
    this.active = false;
    this.pointerId = null;
    this.x = this.y = 0;
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    this.onTouch();
    if (!this.canStart() || this.active) return;
    const r = this.canvas.getBoundingClientRect();
    this.active = true;
    this.pointerId = e.pointerId;
    this.ox = e.clientX - r.left;
    this.oy = e.clientY - r.top;
    this.x = this.y = 0;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture not available */
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.active || e.pointerId !== this.pointerId) return;
    const r = this.canvas.getBoundingClientRect();
    let dx = (e.clientX - r.left - this.ox) / RADIUS;
    let dy = (e.clientY - r.top - this.oy) / RADIUS;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    this.x = dx;
    this.y = dy;
  }

  private onEnd(e: PointerEvent): void {
    if (e.pointerId === this.pointerId) this.reset();
  }
}
