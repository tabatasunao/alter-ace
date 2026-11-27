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

export interface ScreenFrame {
  readonly ctx: CanvasRenderingContext2D;
  readonly world: World;
  readonly palette: Palette;
  readonly view: ViewBounds;
  /** Canvas size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Flash strength multiplier: the player's setting, lowered when the viewer asked for reduced motion. */
  readonly flash: number;
  /** An extra flash (0–1) on top of the world's, while the options preview one. */
  readonly previewFlash: number;
}

/** Strength of the options' preview flash when it starts; it fades from there. */
export const PREVIEW_FLASH = 0.6;

/** Draws in screen coordinates (CSS pixels), over the world. */
export interface ScreenLayer {
  draw(frame: ScreenFrame): void;
}
