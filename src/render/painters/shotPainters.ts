import { TAU } from '../../core/math';
import { ALLY, toneOf, type Projectile, type ProjectileKind, type ShotOfKind } from '../../sim/entities';
import type { Palette } from '../palette';

/**
 * One drawing pass of a projectile look (a missile is a trail stroke, then a head fill).
 * ShotLayer runs each on-screen shot's passes in order.
 *
 * To add a projectile look: give its kind a list of passes below.
 */
export interface ShotPass<P extends Projectile = Projectile> {
  readonly mode: 'stroke' | 'fill';
  /** A palette color (an existing string, so drawing allocates nothing). */
  color(p: P, palette: Palette): string;
  /** Line width for strokes. */
  width?(p: P): number;
  /** Not drawn for the ace's shots while Full Arms runs (a missile's trail). */
  readonly hideInFullArms?: boolean;
  /** Adds the shot's shape to the path ShotLayer just began. Start with moveTo; never beginPath, stroke or fill. */
  trace(ctx: CanvasRenderingContext2D, p: P): void;
}

type ShotLookRegistry = { readonly [K in ProjectileKind]: readonly ShotPass<ShotOfKind<K>>[] };

const BULLET_TRAIL = 0.014;
const BEAM_TRAIL = 0.03;
const MISSILE_TRAIL = 0.04;
const MORTAR_ARC = 170;

/** A streak behind the shot, as long as `trail` seconds of its flight: motion without a particle trail. */
function streak(ctx: CanvasRenderingContext2D, p: { x: number; y: number; vx: number; vy: number }, trail: number): void {
  ctx.moveTo(p.x - p.vx * trail, p.y - p.vy * trail);
  ctx.lineTo(p.x, p.y);
}

/** A missile that has made its terminal correction (committed to its line): its trail brightens. */
function terminal(p: ShotOfKind<'missile'>): boolean {
  return p.homing?.terminalLeft !== undefined;
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

export const SHOT_LOOKS: ShotLookRegistry = {
  bullet: [
    {
      mode: 'stroke',
      color: (p, palette) => (p.src === 'player' ? palette.aceShot : p.team === ALLY ? palette.allyShot : palette.enemyShot),
      width: () => 2,
      trace: (ctx, p) => streak(ctx, p, BULLET_TRAIL),
    },
  ],
  // The ace's bolts in the ace color; the armies' in their own, a little thinner.
  beam: [
    {
      mode: 'stroke',
      color: (p, palette) => (p.src === 'player' ? palette.ace : palette.tone(toneOf(p.team, p.src, p.semiAce))),
      width: (p) => (p.src === 'player' ? p.r : 1.5 + p.r * 0.5),
      trace: (ctx, p) => streak(ctx, p, BEAM_TRAIL),
    },
  ],
  // During Full Arms the ace's missiles drop the trail and show only the glowing head.
  missile: [
    {
      mode: 'stroke',
      hideInFullArms: true,
      color: (p, palette) =>
        p.src === 'player' ? palette.aimLine : terminal(p) ? palette.tone(toneOf(p.team, p.src, p.semiAce)) : palette.dim(toneOf(p.team, p.src, p.semiAce)),
      width: () => 2,
      trace: (ctx, p) => streak(ctx, p, MISSILE_TRAIL),
    },
    {
      mode: 'fill',
      color: (p, palette) => palette.tone(toneOf(p.team, p.src, p.semiAce)),
      trace: (ctx, p) => ctx.rect(p.x - 2.5, p.y - 2.5, 5, 5),
    },
  ],
  shell: [
    {
      mode: 'fill',
      color: (p, palette) => palette.tone(toneOf(p.team, p.src, p.semiAce)),
      trace: (ctx, p) => disc(ctx, p.x, p.y, p.r),
    },
  ],
  // A shadow sliding along the ground under a shell that rises and falls: an arc from two discs.
  mortar: [
    {
      mode: 'fill',
      color: (_p, palette) => palette.gridMajor,
      trace: (ctx, p) => {
        const k = p.t / p.flight;
        disc(ctx, p.sx + (p.tx - p.sx) * k, p.sy + (p.ty - p.sy) * k, 5);
      },
    },
    {
      mode: 'fill',
      color: (_p, palette) => palette.accent,
      trace: (ctx, p) => {
        const k = p.t / p.flight;
        const height = Math.sin(k * Math.PI) * MORTAR_ARC;
        disc(ctx, p.sx + (p.tx - p.sx) * k, p.sy + (p.ty - p.sy) * k - height, 6 + height / 60);
      },
    },
  ],
};
