import { TAU } from '../../core/math';
import type { ScreenLayer } from '../layers';
import type { Palette } from '../palette';

/** What the joystick overlay needs to know; the touch input implements it. */
export interface JoystickView {
  readonly active: boolean;
  /** Origin in CSS pixels. */
  readonly ox: number;
  readonly oy: number;
  /** Deflection, each in -1..1. */
  readonly x: number;
  readonly y: number;
}

const RADIUS = 56;

/** The floating touch joystick. */
export class JoystickLayer implements ScreenLayer {
  constructor(private readonly joystick: JoystickView) {}

  draw(ctx: CanvasRenderingContext2D, palette: Palette): void {
    const j = this.joystick;
    if (!j.active) return;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = palette.ace;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, RADIUS, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = palette.ace;
    ctx.beginPath();
    ctx.arc(j.ox + j.x * RADIUS, j.oy + j.y * RADIUS, 20, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
