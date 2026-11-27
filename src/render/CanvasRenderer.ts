import type { Viewport } from '../sim/scenarios';
import type { World } from '../sim/World';
import { shakeOffset } from './impactView';
import { PREVIEW_FLASH, type ScreenLayer, type WorldLayer } from './layers';
import type { Palette } from './palette';

/** Shake and flash strength when the viewer asked for reduced motion. */
const REDUCED_MOTION = 0.3;
/** The options' preview: a shake (CSS pixels) and a flash, fading over this many milliseconds. */
const PREVIEW = { shake: 12, ms: 450 };

/**
 * Draws a World onto the battlefield canvas by running its layers in order.
 * New visuals are new layers; this class doesn't change.
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private motion = 1;
  private feel = { shake: 1, flash: 1 };
  private previewAt = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private palette: Palette,
    private readonly worldLayers: readonly WorldLayer[],
    private readonly screenLayers: readonly ScreenLayer[],
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduce) {
      const apply = () => {
        this.motion = reduce.matches ? REDUCED_MOTION : 1;
      };
      apply();
      reduce.addEventListener?.('change', apply);
    }
  }

  /** Swaps the colors and fonts (the CJK font follows the interface language). */
  setPalette(palette: Palette): void {
    this.palette = palette;
  }

  /** The player's shake and flash strength (0–1 each). */
  setFeel(feel: { shake: number; flash: number }): void {
    this.feel = { ...feel };
  }

  /** A sample shake and flash at the current strength, so the options show what they change. */
  previewFeel(): void {
    this.previewAt = performance.now();
  }

  /** Canvas size in CSS pixels (with fallbacks before layout). */
  get viewport(): Viewport {
    return { width: this.canvas.clientWidth || 1200, height: this.canvas.clientHeight || 800 };
  }

  get pixelRatio(): number {
    return this.dpr;
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
  }

  render(world: World | null): void {
    const { ctx, dpr, palette } = this;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = palette.field;
    ctx.fillRect(0, 0, vw, vh);
    if (!world) return;

    const { x, y, zoom: z } = world.camera;
    const preview = Math.max(0, 1 - (performance.now() - this.previewAt) / PREVIEW.ms);
    const shakeScale = this.feel.shake * this.motion;
    const flashScale = this.feel.flash * this.motion;
    const impact = preview > 0 ? { ...world.impact, shake: Math.max(world.impact.shake, PREVIEW.shake * preview) } : world.impact;
    const shake = shakeOffset(impact, z, shakeScale);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - x * z + shake.x), dpr * (vh / 2 - y * z + shake.y));
    const view = { x0: x - vw / 2 / z, x1: x + vw / 2 / z, y0: y - vh / 2 / z, y1: y + vh / 2 / z, zoom: z };
    for (const layer of this.worldLayers) layer.draw({ ctx, world, palette, view });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const frame = { ctx, world, palette, view, width: vw, height: vh, flash: flashScale, previewFlash: PREVIEW_FLASH * preview };
    for (const layer of this.screenLayers) layer.draw(frame);
  }
}
