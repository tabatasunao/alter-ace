import { clamp } from '../core/math';
import { ENEMY, type Team, type Unit } from './entities';

/**
 * Uniform grid over the battlefield, rebuilt every step. Cells are linked lists in
 * typed arrays, so rebuilding allocates nothing. Also counts enemies per cell for the
 * Densest pack aim mode.
 */
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cells: number;

  private readonly head: Int32Array;
  private next = new Int32Array(4096);
  private readonly enemyCount: Uint16Array;
  private units: readonly Unit[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
  ) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = this.cols * this.rows;
    this.head = new Int32Array(this.cells);
    this.enemyCount = new Uint16Array(this.cells);
  }

  cellOf(x: number, y: number): number {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** Buckets every unit and stores its cell in `unit.cell`. */
  rebuild(units: readonly Unit[]): void {
    this.units = units;
    this.head.fill(-1);
    this.enemyCount.fill(0);
    if (this.next.length < units.length) this.next = new Int32Array(units.length * 2);
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      const c = this.cellOf(u.x, u.y);
      u.cell = c;
      this.next[i] = this.head[c]!;
      this.head[c] = i;
      if (u.team === ENEMY) this.enemyCount[c]!++;
    }
  }

  /** Visits every unit in the cells overlapping the box. No distance filter: callers filter. */
  forEachInBox(minX: number, minY: number, maxX: number, maxY: number, fn: (u: Unit) => void): void {
    let cx0 = (minX / this.cellSize) | 0;
    let cx1 = (maxX / this.cellSize) | 0;
    let cy0 = (minY / this.cellSize) | 0;
    let cy1 = (maxY / this.cellSize) | 0;
    if (cx0 < 0) cx0 = 0;
    if (cy0 < 0) cy0 = 0;
    if (cx1 >= this.cols) cx1 = this.cols - 1;
    if (cy1 >= this.rows) cy1 = this.rows - 1;
    const units = this.units;
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.cols;
      for (let cx = cx0; cx <= cx1; cx++) {
        let i = this.head[row + cx]!;
        while (i !== -1) {
          fn(units[i]!);
          i = this.next[i]!;
        }
      }
    }
  }

  /** Visits every unit in the cells within `r` of (x, y). Callers filter by exact distance. */
  eachNear(x: number, y: number, r: number, fn: (u: Unit) => void): void {
    this.forEachInBox(x - r, y - r, x + r, y + r, fn);
  }

  /**
   * Visits every unit in the cells within `pad` of segment AB, each cell once. Walks the columns
   * the padded segment spans and, in each, only the rows the segment crosses there, so a long
   * beam touches a thin band of cells rather than its whole bounding box. Callers filter by exact
   * distance; `pad` should cover the hit width plus the largest unit radius.
   */
  forEachNearSegment(ax: number, ay: number, bx: number, by: number, pad: number, fn: (u: Unit) => void): void {
    const cs = this.cellSize;
    const segMinX = Math.min(ax, bx);
    const segMaxX = Math.max(ax, bx);
    const dx = bx - ax;
    const slope = Math.abs(dx) < 1e-9 ? 0 : (by - ay) / dx;
    const cx0 = clamp(Math.floor((segMinX - pad) / cs), 0, this.cols - 1);
    const cx1 = clamp(Math.floor((segMaxX + pad) / cs), 0, this.cols - 1);
    const units = this.units;
    for (let cx = cx0; cx <= cx1; cx++) {
      // The part of the segment within `pad` of this column, and the rows it covers.
      let yLo: number;
      let yHi: number;
      if (slope === 0 && Math.abs(dx) < 1e-9) {
        yLo = Math.min(ay, by);
        yHi = Math.max(ay, by);
      } else {
        const ya = ay + (Math.max(cx * cs - pad, segMinX) - ax) * slope;
        const yb = ay + (Math.min((cx + 1) * cs + pad, segMaxX) - ax) * slope;
        yLo = Math.min(ya, yb);
        yHi = Math.max(ya, yb);
      }
      const cy0 = clamp(Math.floor((yLo - pad) / cs), 0, this.rows - 1);
      const cy1 = clamp(Math.floor((yHi + pad) / cs), 0, this.rows - 1);
      for (let cy = cy0; cy <= cy1; cy++) {
        let i = this.head[cy * this.cols + cx]!;
        while (i !== -1) {
          fn(units[i]!);
          i = this.next[i]!;
        }
      }
    }
  }

  /** Visits each pair of units sharing a cell (for separation). */
  forEachPairInCell(fn: (a: Unit, b: Unit) => void): void {
    const units = this.units;
    for (let c = 0; c < this.cells; c++) {
      let i = this.head[c]!;
      while (i !== -1) {
        const a = units[i]!;
        let j = this.next[i]!;
        while (j !== -1) {
          fn(a, units[j]!);
          j = this.next[j]!;
        }
        i = this.next[i]!;
      }
    }
  }

  /** Nearest living unit not on `team`, within `maxR`. Searches outward ring by ring. */
  nearestHostile(x: number, y: number, team: Team, maxR: number): Unit | null {
    const units = this.units;
    const cx = clamp((x / this.cellSize) | 0, 0, this.cols - 1);
    const cy = clamp((y / this.cellSize) | 0, 0, this.rows - 1);
    const maxRing = Math.ceil(maxR / this.cellSize);
    let best: Unit | null = null;
    let bestD = maxR * maxR;
    for (let ring = 0; ring <= maxRing; ring++) {
      if (best && (ring - 1) * this.cellSize > Math.sqrt(bestD)) break;
      const x0 = cx - ring;
      const x1 = cx + ring;
      const y0 = cy - ring;
      const y1 = cy + ring;
      for (let gy = y0; gy <= y1; gy++) {
        if (gy < 0 || gy >= this.rows) continue;
        const edge = gy === y0 || gy === y1;
        const step = edge ? 1 : Math.max(1, x1 - x0);
        for (let gx = x0; gx <= x1; gx += step) {
          if (gx < 0 || gx >= this.cols) continue;
          let i = this.head[gy * this.cols + gx]!;
          while (i !== -1) {
            const v = units[i]!;
            if (v.team !== team && v.alive) {
              const dx = v.x - x;
              const dy = v.y - y;
              const d = dx * dx + dy * dy;
              if (d < bestD) {
                bestD = d;
                best = v;
              }
            }
            i = this.next[i]!;
          }
        }
      }
    }
    return best;
  }

  /** Enemies in the 3×3 cells around `cell`. */
  clusterAt(cell: number): number {
    const cx = cell % this.cols;
    const cy = (cell / this.cols) | 0;
    let n = 0;
    for (let y = cy - 1; y <= cy + 1; y++) {
      if (y < 0 || y >= this.rows) continue;
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (x >= 0 && x < this.cols) n += this.enemyCount[y * this.cols + x]!;
      }
    }
    return n;
  }
}
