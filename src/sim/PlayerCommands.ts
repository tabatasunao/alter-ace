import { clamp } from '../core/math';
import { addStatus } from './statuses';
import { burstAll, startReload } from './weapons/firing';
import { useTool } from './tools/useTool';
import type { World } from './World';

/**
 * Everything the player can order the ace to do. Input devices and HUD buttons call these;
 * they don't touch world state themselves.
 */
export class PlayerCommands {
  constructor(private readonly world: World) {}

  get canAct(): boolean {
    const w = this.world;
    return !w.isDemo && !w.status.over && !w.status.paused && !!w.player?.alive;
  }

  /** Makes a weapon slot active, or uses a tool slot. */
  selectSlot(index: number): void {
    if (!this.canAct) return;
    const P = this.world.player!;
    const slot = P.slots[index];
    if (!slot) return;
    if (slot.kind === 'tool') {
      useTool(this.world, P, index);
      return;
    }
    P.active = index;
    this.world.aim.timer = 0;
  }

  setAim(index: number): void {
    const w = this.world;
    if (w.isDemo || w.status.over) return;
    const n = w.catalog.aimModes.length;
    w.aim.index = ((index % n) + n) % n;
    w.aim.timer = 0;
  }

  cycleAim(delta: number): void {
    this.setAim(this.world.aim.index + delta);
  }

  dash(): void {
    if (!this.canAct) return;
    const P = this.world.player!;
    if (P.dashCd > 0 || P.dash) return;
    const cfg = this.world.catalog.battle.player;
    let dx = P.input.x;
    let dy = P.input.y;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(P.facing);
      dy = Math.sin(P.facing);
    }
    const m = Math.hypot(dx, dy) || 1;
    const speed = cfg.dashDistance / cfg.dashDuration;
    P.dash = { remaining: cfg.dashDuration, vx: (dx / m) * speed, vy: (dy / m) * speed };
    P.iframes = cfg.dashIframes;
    P.dashCd = P.frame.dashCd;
  }

  /** Super release: a fireworks burst from every weapon, then every hardpoint fires at once for a few seconds. */
  superRelease(): void {
    if (!this.canAct) return;
    const P = this.world.player!;
    if (P.releaseCd > 0) return;
    const { duration, cooldown, openingBurst } = this.world.catalog.battle.player.superRelease;
    burstAll(this.world, P, openingBurst);
    addStatus(P, { id: 'superRelease', label: 'Super release', remaining: duration, mods: {}, heal: 0, ring: true, allWeapons: true });
    P.releaseCd = cooldown;
  }

  /** Reloads the active weapon early. */
  reload(): void {
    if (!this.canAct) return;
    const P = this.world.player!;
    const slot = P.slots[P.active];
    if (slot?.kind === 'weapon' && slot.def.mag !== null && slot.ammo < slot.def.mag) startReload(P, slot);
  }

  zoomBy(factor: number): void {
    const w = this.world;
    if (w.isDemo) return;
    const { minZoom, maxZoom } = w.catalog.battle.camera;
    w.camera.zoomTarget = clamp(w.camera.zoomTarget * factor, minZoom, maxZoom);
  }
}
