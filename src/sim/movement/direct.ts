import type { DirectMovement } from '../../data/types';
import type { MovementModel } from './MovementModel';

/** Direct steering: velocity eases toward input × top speed almost at once. */
export const direct: MovementModel<DirectMovement> = {
  steer({ player: P, input, topSpeed, dt, config }) {
    const k = Math.min(1, dt * config.response);
    P.vx += (input.x * topSpeed - P.vx) * k;
    P.vy += (input.y * topSpeed - P.vy) * k;
  },
};
