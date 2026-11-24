import { isSemiAce, unitTone } from '../sim/entities';
import type { Viewport } from '../sim/scenarios';
import type { World } from '../sim/World';
import type { Palette } from './palette';

/** The battle minimap: every unit as a dot, reinforcement markers, the ace, and the camera's view. */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly palette: Palette,
    private readonly pixelRatio: () => number,
    private readonly mainViewport: () => Viewport,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
  }

  draw(world: World): void {
    const { canvas, ctx, palette } = this;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = this.pixelRatio();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sx = w / world.width;
    const sy = h / world.height;

    for (const u of world.units) {
      if (u.kind === 'player') continue;
      ctx.fillStyle = u.kind === 'decoy' ? palette.tool : palette.tone(unitTone(u));
      const d = u.kind === 'soldier' && (u.def.aura || isSemiAce(u)) ? 3 : 1.6;
      ctx.fillRect(u.x * sx - d / 2, u.y * sy - d / 2, d, d);
    }
    if (world.stats.enemyQueue.length) {
      ctx.fillStyle = palette.enemy;
      for (let i = 0; i < 3; i++) ctx.fillRect(w - 3, h * (0.3 + i * 0.2) - 4, 2, 8);
    }
    const P = world.player;
    if (P?.alive) {
      ctx.fillStyle = palette.ace;
      ctx.fillRect(P.x * sx - 2.5, P.y * sy - 2.5, 5, 5);
    }
    const c = world.camera;
    const vp = this.mainViewport();
    const vw = vp.width / c.zoom;
    const vh = vp.height / c.zoom;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect((c.x - vw / 2) * sx, (c.y - vh / 2) * sy, vw * sx, vh * sy);
  }
}
