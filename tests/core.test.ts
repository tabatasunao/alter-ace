import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { chunks, formatClock, segmentDistance, wrapAngle } from '../src/core/math';
import { SeededRandom } from '../src/core/random';
import { VariableStep } from '../src/core/timestep';

describe('SeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    expect(Array.from({ length: 50 }, () => b.next())).toEqual(seqA);
    expect(new SeededRandom(43).next()).not.toBe(seqA[0]);
  });

  it('stays in range and shuffles into a permutation', () => {
    const r = new SeededRandom(7);
    for (let i = 0; i < 5000; i++) {
      const v = r.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
    const items = Array.from({ length: 100 }, (_, i) => i);
    const shuffled = r.shuffle([...items]);
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
  });
});

describe('time stepper', () => {
  it('VariableStep runs one capped step per frame', () => {
    const steps: number[] = [];
    const s = new VariableStep(0.05);
    s.advance(0.016, (dt) => steps.push(dt));
    s.advance(1, (dt) => steps.push(dt));
    expect(s.advance(0, () => steps.push(-1))).toBe(0);
    expect(steps).toEqual([0.016, 0.05]);
  });
});

describe('EventBus', () => {
  it('delivers to subscribers until they unsubscribe', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    const got: number[] = [];
    const off = bus.on('ping', ({ n }) => got.push(n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1]);
  });
});

describe('math helpers', () => {
  it('chunks arrays, formats clocks, measures segment distance and wraps angles', () => {
    expect(chunks([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(formatClock(83.9)).toBe('1:23');
    expect(segmentDistance(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(segmentDistance(-4, 3, 0, 0, 10, 0)).toBe(5);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});
