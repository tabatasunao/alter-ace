import type { ImpactState } from '../sim/impact';

/** Shakes smaller than this move the view only vertically; bigger ones move it both ways. */
const VERTICAL_ONLY_BELOW = 5;

/**
 * The view's shake offset in CSS pixels. Small shakes are vertical only; bigger ones wobble both
 * ways. Wider camera views shake a little more, so the shake still reads from far out.
 */
export function shakeOffset(impact: ImpactState, zoom: number, motion: number): { x: number; y: number } {
  if (impact.shake <= 0) return { x: 0, y: 0 };
  const amp = impact.shake * motion * (1 + 0.5 * Math.max(0, 1 - zoom));
  const t = impact.clock;
  const y = amp * Math.sin(t * 67 + 1.3);
  const x = impact.shake < VERTICAL_ONLY_BELOW ? 0 : amp * Math.sin(t * 91);
  return { x, y };
}
