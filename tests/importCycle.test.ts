import { describe, expect, it, vi } from 'vitest';

describe('module import order', () => {
  it('loads a weapon behavior first without hitting an import cycle', async () => {
    vi.resetModules();
    await expect(import('../src/sim/weapons/behaviors/rail')).resolves.toBeDefined();
    const { WEAPON_BEHAVIORS } = await import('../src/sim/weapons/registry');
    expect(WEAPON_BEHAVIORS.rail).toBeDefined();
  });
});
