import type { ThrusterMovement } from '../../data/types';
import type { MovementModel } from './MovementModel';

/** Below this speed a coasting ace comes to rest instead of drifting forever. */
const REST_SPEED = 1;

/**
 * Thrusters with inertia. Input is an acceleration, not a velocity:
 * - thrusting accelerates toward top speed over `thrustTime`, and turning swings the
 *   velocity around (sideways drift bleeds off at `lateralDrag`);
 * - letting go coasts, slowing at `drag`;
 * - speed above the cap (e.g. after a dash or a launch) bleeds off at `drag` instead of snapping.
 */
export const thruster: MovementModel<ThrusterMovement> = {
  steer({ player: P, input, topSpeed, dt, config: c }) {
    const prevSpeed = Math.hypot(P.vx, P.vy);
    const inputSize = Math.hypot(input.x, input.y);
    const thrusting = inputSize > 0.05;

    const accel = topSpeed / c.thrustTime;
    P.vx += input.x * accel * dt;
    P.vy += input.y * accel * dt;

    if (thrusting) {
      // Split velocity into along-thrust and sideways parts; damp only the sideways drift.
      const nx = input.x / inputSize;
      const ny = input.y / inputSize;
      const along = P.vx * nx + P.vy * ny;
      const keep = Math.exp(-c.lateralDrag * dt);
      P.vx = along * nx + (P.vx - along * nx) * keep;
      P.vy = along * ny + (P.vy - along * ny) * keep;
    } else {
      const keep = Math.exp(-c.drag * dt);
      P.vx *= keep;
      P.vy *= keep;
    }

    const speed = Math.hypot(P.vx, P.vy);
    if (!thrusting && speed < REST_SPEED) {
      P.vx = P.vy = 0;
      return;
    }
    const limit = prevSpeed > topSpeed ? Math.max(topSpeed, prevSpeed * Math.exp(-c.drag * dt)) : topSpeed;
    if (speed > limit) {
      P.vx *= limit / speed;
      P.vy *= limit / speed;
    }
  },

  afterDash({ player: P, dashVx, dashVy, topSpeed, config }) {
    const m = Math.hypot(dashVx, dashVy) || 1;
    const carry = topSpeed * config.dashCarry;
    P.vx = (dashVx / m) * carry;
    P.vy = (dashVy / m) * carry;
  },
};
