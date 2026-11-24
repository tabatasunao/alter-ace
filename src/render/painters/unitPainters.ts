import { TAU } from '../../core/math';
import { ALLY, unitTone, type Decoy, type Soldier } from '../../sim/entities';
import type { Palette } from '../palette';

/**
 * Draws one AI unit's body. `color` already accounts for team and hit flash.
 * To add a unit look: implement this, register it under a new shape name below,
 * and use that name as `shape` in units.json.
 */
export interface UnitPainter {
  paint(ctx: CanvasRenderingContext2D, u: Soldier, color: string, palette: Palette): void;
}

const square: UnitPainter = {
  paint(ctx, u, color) {
    const s = u.size;
    const h = s / 2;
    ctx.fillStyle = color;
    ctx.fillRect(u.x - h, u.y - h, s, s);
  },
};

const diamond: UnitPainter = {
  paint(ctx, u, color) {
    const h = u.size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y - h - 1);
    ctx.lineTo(u.x + h + 1, u.y);
    ctx.lineTo(u.x, u.y + h + 1);
    ctx.lineTo(u.x - h - 1, u.y);
    ctx.closePath();
    ctx.fill();
  },
};

const hollow: UnitPainter = {
  paint(ctx, u, color, palette) {
    const s = u.size;
    const h = s / 2;
    ctx.fillStyle = palette.dim(unitTone(u));
    ctx.fillRect(u.x - h, u.y - h, s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(u.x - h + 1.5, u.y - h + 1.5, s - 3, s - 3);
    ctx.fillStyle = color;
    ctx.fillRect(u.x - 3, u.y - 3, 6, 6);
  },
};

const barrel: UnitPainter = {
  paint(ctx, u, color) {
    const s = u.size;
    const h = s / 2;
    ctx.fillStyle = color;
    ctx.fillRect(u.x - h, u.y - h, s, s);
    const t = u.target;
    if (!t) return;
    const a = Math.atan2(t.y - u.y, t.x - u.x);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(u.x + Math.cos(a) * s * 1.15, u.y + Math.sin(a) * s * 1.15);
    ctx.stroke();
  },
};

const nested: UnitPainter = {
  paint(ctx, u, color, palette) {
    const s = u.size;
    const h = s / 2;
    ctx.fillStyle = color;
    ctx.fillRect(u.x - h, u.y - h, s, s);
    ctx.fillStyle = palette.field;
    ctx.fillRect(u.x - h + 5, u.y - h + 5, s - 10, s - 10);
    ctx.fillStyle = color;
    ctx.fillRect(u.x - 2.5, u.y - 2.5, 5, 5);
  },
};

/** Hexagon path centered on (x, y). */
function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** A coated hexagon with a bright lens in the middle (Prism). */
const hex: UnitPainter = {
  paint(ctx, u, color, palette) {
    const r = u.size * 0.6;
    hexPath(ctx, u.x, u.y, r);
    ctx.fillStyle = palette.dim(unitTone(u));
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    hexPath(ctx, u.x, u.y, r * 0.38);
    ctx.fillStyle = color;
    ctx.fill();
  },
};

/** An arrowhead pointing where the unit is going (Breacher). */
const chevron: UnitPainter = {
  paint(ctx, u, color) {
    const h = u.size / 2;
    const moving = Math.hypot(u.vx, u.vy) > 5;
    const t = u.target;
    const a = moving ? Math.atan2(u.vy, u.vx) : t ? Math.atan2(t.y - u.y, t.x - u.x) : u.team === ALLY ? 0 : Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pt = (fx: number, fy: number): [number, number] => [u.x + fx * c - fy * s, u.y + fx * s + fy * c];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...pt(h + 2, 0));
    ctx.lineTo(...pt(-h, h));
    ctx.lineTo(...pt(-h * 0.35, 0));
    ctx.lineTo(...pt(-h, -h));
    ctx.closePath();
    ctx.fill();
  },
};

/** A square outline, the beam-armed sibling of the filled Trooper square (Beam Trooper). */
const frame: UnitPainter = {
  paint(ctx, u, color) {
    const s = u.size;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(u.x - s / 2 + 1.25, u.y - s / 2 + 1.25, s - 2.5, s - 2.5);
  },
};

/** A scope ring with a bright pip (Sentinel). Its charging sight line is drawn by SightLineLayer. */
const reticle: UnitPainter = {
  paint(ctx, u, color) {
    const r = u.size * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(u.x, u.y, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(u.x - 1.5, u.y - 1.5, 3, 3);
  },
};

/** Two missile pods side by side (Hornet). Plain rectangles, so it costs no path. */
const twin: UnitPainter = {
  paint(ctx, u, color) {
    const h = u.size / 2;
    const w = h * 0.8;
    ctx.fillStyle = color;
    ctx.fillRect(u.x - h, u.y - h, w, u.size);
    ctx.fillRect(u.x + h - w, u.y - h, w, u.size);
  },
};

/** Which way a unit faces: toward its target, else along its motion, else its army's default. */
function facing(u: Soldier): number {
  const t = u.target;
  if (t) return Math.atan2(t.y - u.y, t.x - u.x);
  if (Math.hypot(u.vx, u.vy) > 5) return Math.atan2(u.vy, u.vx);
  return u.team === ALLY ? 0 : Math.PI;
}

/** The thin ring drawn around every semi-ace, in the semi-ace color. */
function halo(ctx: CanvasRenderingContext2D, u: Soldier, palette: Palette): void {
  ctx.strokeStyle = palette.dim(unitTone(u));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(u.x, u.y, u.size, 0, TAU);
  ctx.stroke();
}

/** Points (forward, side) in the unit's facing frame, as a closed filled path. */
function fillShape(ctx: CanvasRenderingContext2D, u: Soldier, a: number, points: readonly (readonly [number, number])[]): void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.beginPath();
  points.forEach(([f, side], i) => {
    const x = u.x + f * c - side * s;
    const y = u.y + f * s + side * c;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

/** A long, thin spearhead aimed at the target (Marksman, long beam rifle). */
const spear: UnitPainter = {
  paint(ctx, u, color, palette) {
    halo(ctx, u, palette);
    const h = u.size / 2;
    ctx.fillStyle = color;
    fillShape(ctx, u, facing(u), [[h * 1.9, 0], [0, h * 0.7], [-h, 0], [0, -h * 0.7]]);
  },
};

/** A four-point star (Circus, micro-missile swarm). */
const star: UnitPainter = {
  paint(ctx, u, color, palette) {
    halo(ctx, u, palette);
    const r = u.size * 0.75;
    const k = r * 0.32;
    ctx.fillStyle = color;
    fillShape(ctx, u, Math.PI / 4, [[r, 0], [k, k], [0, r], [-k, k], [-r, 0], [-k, -k], [0, -r], [k, -k]]);
  },
};

/** A hollow diamond crossed by a bright blade aimed at the target (Duelist, beam saber). */
const blade: UnitPainter = {
  paint(ctx, u, color, palette) {
    halo(ctx, u, palette);
    const h = u.size / 2 + 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y - h);
    ctx.lineTo(u.x + h, u.y);
    ctx.lineTo(u.x, u.y + h);
    ctx.lineTo(u.x - h, u.y);
    ctx.closePath();
    ctx.stroke();
    const a = facing(u);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x - Math.cos(a) * h * 0.4, u.y - Math.sin(a) * h * 0.4);
    ctx.lineTo(u.x + Math.cos(a) * h * 1.8, u.y + Math.sin(a) * h * 1.8);
    ctx.stroke();
  },
};

export const UNIT_PAINTERS: Readonly<Record<string, UnitPainter>> = {
  square,
  frame,
  diamond,
  hollow,
  barrel,
  nested,
  hex,
  chevron,
  reticle,
  twin,
  spear,
  star,
  blade,
};

/** The decoy beacon: blinking crossed box with a pulsing ring. */
export function paintDecoy(ctx: CanvasRenderingContext2D, d: Decoy, palette: Palette, time: number): void {
  const s = d.size;
  const h = s / 2;
  const { x, y } = d;
  ctx.strokeStyle = palette.tool;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - h, y - h, s, s);
  if (((time * 6) | 0) % 2 === 0) {
    ctx.beginPath();
    ctx.moveTo(x - h, y - h);
    ctx.lineTo(x + h, y + h);
    ctx.moveTo(x + h, y - h);
    ctx.lineTo(x - h, y + h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 30 + ((time * 40) % 40), 0, TAU);
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
