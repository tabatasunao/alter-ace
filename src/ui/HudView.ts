import { clamp, formatClock } from '../core/math';
import type { CommandSink } from '../input/commands';
import { ENEMY, type Player, type Status } from '../sim/entities';
import { RELEASE_STATUS } from '../sim/release';
import type { World } from '../sim/World';
import { slotLabel } from './damageText';
import { byId, replayAnimation, setText } from './dom';

/** How long the lost-HP segment holds before it drains, and how fast it drains (share of max HP per second). */
const HP_LAG_HOLD_MS = 400;
const HP_LAG_DRAIN = 0.8;
/** Minimum time between HP bar shudders, so constant fire does not restart it every frame. */
const HP_HIT_GAP_MS = 120;

interface SlotElements {
  root: HTMLButtonElement;
  amount: HTMLElement;
  progress: HTMLElement;
}

/** The battle HUD: army counts, clock, pilot status, hardpoints and aim mode buttons. */
export class HudView {
  private slots: SlotElements[] = [];
  /** The lost-HP segment behind the HP bar, and what it tracks. */
  private readonly hpLag: HTMLElement;
  private lastHp = 0;
  private lagHp = 0;
  private lagHoldUntil = 0;
  private lastFrame = 0;
  private lastShudder = 0;
  private releaseWasReady = true;
  private aimButtons: HTMLButtonElement[] = [];
  private readonly el = {
    enemy: byId('hEnemy'),
    enemyOf: byId('hEnemyOf'),
    enemyBar: byId('hEnemyBar'),
    reserve: byId('hReserve'),
    ally: byId('hAlly'),
    allyOf: byId('hAllyOf'),
    allyBar: byId('hAllyBar'),
    allySub: byId('hAllySub'),
    time: byId('hTime'),
    kills: byId('hKills'),
    pilotCode: byId('pCode'),
    hpWrap: byId('pHpWrap'),
    hp: byId('pHp'),
    hpText: byId('pHpText'),
    dash: byId('pDash'),
    release: byId('pRelease'),
    statuses: byId('pStatuses'),
    aimCycle: byId('aimCycle'),
    slots: byId('slots'),
    aimGrid: byId('aimGrid'),
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly sink: CommandSink,
  ) {
    this.hpLag = document.createElement('i');
    this.hpLag.className = 'lag';
    this.el.hpWrap.prepend(this.hpLag);
    this.el.aimCycle.addEventListener('click', () => sink.cycleAim(1));
    byId('btnDash').addEventListener('click', () => sink.dash());
    byId('btnRelease').addEventListener('click', () => sink.superRelease());
    byId('btnPause').addEventListener('click', () => sink.togglePause(true));
    // Keep keyboard focus on the page so WASD keeps working after clicking a HUD button.
    root.addEventListener('mousedown', (e) => {
      if ((e.target as Element).closest('button')) e.preventDefault();
    });
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Builds the hardpoint and aim mode buttons for this battle. */
  build(world: World): void {
    const P = world.player!;
    this.lastHp = this.lagHp = P.hp;
    this.el.pilotCode.textContent = `${P.frame.code} ${P.frame.name} · ${P.frame.type}`;
    setText(this.el.enemyOf, `/${world.stats.enemyTotal}`);
    setText(this.el.allyOf, `/${world.stats.allyTotal}`);

    this.el.slots.innerHTML = '';
    this.slots = P.slots.map((slot, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = `slot${slot.kind === 'tool' ? ' tool' : ''}`;
      const label = slotLabel(world.catalog, slot.def);
      b.innerHTML = `<span class="k">${i + 1} · ${label}</span><span class="n"></span><span class="a"></span><i class="p"></i>`;
      b.querySelector('.n')!.textContent = slot.def.name;
      b.addEventListener('click', () => this.sink.selectSlot(i));
      this.el.slots.appendChild(b);
      return { root: b, amount: b.querySelector<HTMLElement>('.a')!, progress: b.querySelector<HTMLElement>('.p')! };
    });

    this.el.aimGrid.innerHTML = '';
    this.aimButtons = world.catalog.aimModes.map((mode, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = 'aim-btn';
      b.innerHTML = `<span class="k">${mode.key}</span>`;
      b.appendChild(document.createTextNode(mode.name));
      b.title = mode.desc;
      b.addEventListener('click', () => this.sink.setAimIndex(i));
      this.el.aimGrid.appendChild(b);
      return b;
    });
  }

  update(world: World): void {
    const P = world.player!;
    const s = world.stats;
    const el = this.el;
    const remaining = world.enemiesLeft;
    setText(el.enemy, remaining);
    el.enemyBar.style.transform = `scaleX(${remaining / s.enemyTotal})`;
    setText(el.reserve, s.enemyQueue.length ? `${s.enemyQueue.length} in reserve` : 'No reserves left');
    const allies = Math.max(0, s.allyAlive);
    setText(el.ally, allies);
    el.allyBar.style.transform = `scaleX(${allies / s.allyTotal})`;
    const breaking = world.catalog.battle.alerts.breakingAllies;
    setText(el.allySub, allies <= 0 ? 'Line has fallen' : allies < breaking ? 'Line is breaking' : 'Holding the line');
    setText(el.time, formatClock(world.status.over ? world.status.endAt : world.t));
    setText(el.kills, `${s.kills} kills`);

    const hpFrac = Math.max(0, P.hp / P.maxHp);
    el.hp.style.transform = `scaleX(${hpFrac})`;
    this.renderHpLoss(Math.max(0, P.hp), P.maxHp);
    el.hpWrap.classList.toggle('low', hpFrac < world.catalog.battle.alerts.criticalHp);
    setText(el.hpText, `${Math.max(0, Math.ceil(P.hp))} / ${P.maxHp} HP`);
    const dashReady = P.dashCd <= 0;
    setText(el.dash, dashReady ? 'Dash ready' : `Dash ${P.dashCd.toFixed(1)}`);
    el.dash.classList.toggle('ready', dashReady);
    this.renderRelease(world, P);
    this.renderStatuses(P.statuses.filter((s) => s.id !== RELEASE_STATUS)); // the release chip shows its own countdown

    P.slots.forEach((slot, i) => {
      const view = this.slots[i];
      if (!view) return;
      let progress: number;
      let label: string;
      let reloading = false;
      let ready = false;
      if (slot.kind === 'weapon') {
        if (slot.reloadT > 0) {
          label = slot.def.heat ? 'Overheat' : 'Reloading';
          progress = 1 - slot.reloadT / slot.reloadTotal;
          reloading = true;
        } else if (slot.def.heat && slot.def.mag !== null) {
          const heat = 1 - slot.ammo / slot.def.mag;
          const spin = slot.def.spin;
          const rate = spin ? spin.start + (spin.top - spin.start) * slot.spin : 1;
          label = `Heat ${Math.round(heat * 100)}%${spin ? ` · ×${rate.toFixed(1)}` : ''}`;
          progress = 1 - heat;
        } else if (slot.def.mag === null) {
          label = '∞';
          progress = 1;
        } else {
          label = `${slot.ammo} / ${slot.def.mag}`;
          progress = slot.ammo / slot.def.mag;
        }
      } else if (slot.cd > 0) {
        label = `${slot.cd.toFixed(1)} s`;
        progress = 1 - slot.cd / slot.cdTotal;
      } else {
        label = 'Ready';
        progress = 1;
        ready = true;
      }
      setText(view.amount, label);
      view.progress.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
      view.root.classList.toggle('active', i === P.active);
      view.root.classList.toggle('reloading', reloading);
      view.root.classList.toggle('ready', ready);
    });
    this.aimButtons.forEach((b, i) => b.classList.toggle('on', i === world.aim.index));
    setText(el.aimCycle, `Aim: ${world.catalog.aimModes[world.aim.index]!.name} ›`);
  }

  /**
   * Damage on the HP bar: the bar shudders, and the HP just lost stays as a red segment for a
   * moment, then drains down to the bar.
   */
  private renderHpLoss(hp: number, maxHp: number): void {
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (hp < this.lastHp - 1e-6) {
      this.lagHoldUntil = now + HP_LAG_HOLD_MS;
      if (now - this.lastShudder > HP_HIT_GAP_MS) {
        this.lastShudder = now;
        replayAnimation(this.el.hpWrap, 'hit');
      }
    }
    this.lastHp = hp;
    if (hp >= this.lagHp) this.lagHp = hp;
    else if (now > this.lagHoldUntil) this.lagHp = Math.max(hp, this.lagHp - maxHp * HP_LAG_DRAIN * dt);
    this.hpLag.style.transform = `scaleX(${this.lagHp / maxHp})`;
  }

  /**
   * The super release chip: the gauge filling up, then ready (with its key and how many enemies are
   * inside the close-kill radius, where the burst does the most), then the release running.
   */
  private renderRelease(world: World, P: Player): void {
    const chip = this.el.release;
    const ready = P.releaseCharge >= 1 && !P.release;
    let text: string;
    if (P.release) {
      text = `Releasing ${Math.max(0, P.release.duration - P.release.elapsed).toFixed(1)}`;
    } else if (ready) {
      const r = world.catalog.battle.player.superRelease.charge.closeRadius;
      let close = 0;
      for (const u of world.units) {
        if (u.team === ENEMY && u.kind === 'soldier' && u.alive && Math.abs(u.x - P.x) <= r && Math.hypot(u.x - P.x, u.y - P.y) <= r) close++;
      }
      text = close > 0 ? `Release ready · Space · ${close} close` : 'Release ready · Space';
    } else {
      text = `Release ${Math.floor(P.releaseCharge * 100)}%`;
    }
    setText(chip, text);
    chip.style.setProperty('--fill', `${Math.round((P.release ? 1 : P.releaseCharge) * 100)}%`);
    chip.classList.toggle('ready', ready);
    if (ready && !this.releaseWasReady) replayAnimation(chip, 'ping');
    this.releaseWasReady = ready;
    chip.classList.toggle('active', !!P.release);
    chip.classList.toggle('charging', !ready && !P.release);
  }

  /** One chip per running status ("Overboost 3.2"), reusing chip elements between frames. */
  private renderStatuses(statuses: readonly Status[]): void {
    const box = this.el.statuses;
    while (box.children.length < statuses.length) {
      const chip = document.createElement('span');
      chip.className = 'chip boost';
      box.appendChild(chip);
    }
    Array.from(box.children).forEach((chip, i) => {
      const s = statuses[i];
      (chip as HTMLElement).hidden = !s;
      if (s) setText(chip as HTMLElement, `${s.label} ${s.remaining.toFixed(1)}`);
    });
  }

  /** Shakes a hardpoint whose tool is still recharging. */
  deny(slot: number): void {
    const view = this.slots[slot];
    if (view) replayAnimation(view.root, 'denied');
  }
}
