import type { World } from '../sim/World';
import type { Palette } from './palette';

/** The visible part of the world this frame, in world units. */
export interface ViewBounds {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly zoom: number;
}

export interface WorldFrame {
  readonly ctx: CanvasRenderingContext2D;
  readonly world: World;
  readonly palette: Palette;
  readonly view: ViewBounds;
}

/** Draws in world coordinates (the camera transform is already applied). */
export interface WorldLayer {
  draw(frame: WorldFrame): void;
}

/** Draws in screen coordinates (CSS pixels), over the world. */
export interface ScreenLayer {
  draw(ctx: CanvasRenderingContext2D, palette: Palette): void;
}
