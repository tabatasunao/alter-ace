import type { WorldFrame, WorldLayer } from '../layers';

const STEP = 200;
const SECTOR = 1000;
const SECTOR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Minor and major grid lines, the arena border, and sector labels (A1, B2…). */
export class GridLayer implements WorldLayer {
  draw({ ctx, world, palette, view }: WorldFrame): void {
    const W = world.width;
    const H = world.height;
    const { x0, y0, x1, y1, zoom: z } = view;
    const gx0 = Math.max(0, Math.floor(x0 / STEP) * STEP);
    const gx1 = Math.min(W, x1);
    const gy0 = Math.max(0, Math.floor(y0 / STEP) * STEP);
    const gy1 = Math.min(H, y1);
    const ya = Math.max(0, y0);
    const yb = Math.min(H, y1);
    const xa = Math.max(0, x0);
    const xb = Math.min(W, x1);

    const lines = (major: boolean) => {
      ctx.beginPath();
      for (let x = gx0; x <= gx1; x += STEP) {
        if ((x % SECTOR === 0) === major) {
          ctx.moveTo(x, ya);
          ctx.lineTo(x, yb);
        }
      }
      for (let y = gy0; y <= gy1; y += STEP) {
        if ((y % SECTOR === 0) === major) {
          ctx.moveTo(xa, y);
          ctx.lineTo(xb, y);
        }
      }
      ctx.stroke();
    };
    ctx.lineWidth = 1 / z;
    ctx.strokeStyle = palette.grid;
    lines(false);
    ctx.strokeStyle = palette.gridMajor;
    lines(true);

    ctx.strokeStyle = palette.gridLabel;
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(0, 0, W, H);

    ctx.fillStyle = palette.gridLabel;
    ctx.font = `600 ${14 / z}px ${palette.fontDisplay}`;
    ctx.textBaseline = 'top';
    const maxCol = Math.ceil(W / SECTOR) - 1;
    const maxRow = Math.ceil(H / SECTOR) - 1;
    for (let i = Math.max(0, Math.floor(x0 / SECTOR)); i <= Math.min(maxCol, Math.floor(x1 / SECTOR)); i++) {
      for (let j = Math.max(0, Math.floor(y0 / SECTOR)); j <= Math.min(maxRow, Math.floor(y1 / SECTOR)); j++) {
        ctx.fillText(SECTOR_LETTERS[i]! + (j + 1), i * SECTOR + 10 / z, j * SECTOR + 8 / z);
      }
    }
  }
}
