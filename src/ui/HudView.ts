import { clamp, formatClock } from '../core/math';
import type { CommandSink } from '../input/commands';
import { slotAction } from '../game/settings';
import type { KeyMap } from '../input/keymap';
import { ENEMY, type Player } from '../sim/entities';
import type { World } from '../sim/World';
import { slotLabel } from './damageText';
import { byId, escapeHtml, kbdHtml, readoutHtml, replayAnimation, setHtml, setText } from './dom';
import { t } from '../i18n';
import { dataText } from '../i18n/data';

/** How long the lost-HP segment holds before it drains, and how fast it drains (share of max HP per second). */
const HP_LAG_HOLD_MS = 400;
const HP_LAG_DRAIN = 0.8;
/** Minimum time between HP bar shudders, so constant fire does not restart it every frame. */
const HP_HIT_GAP_MS = 120;
/** How long the aim mode grid stays open after the mode changes. */
const AIM_OPEN_MS = 2200;

interface SlotElements {
  root: HTMLButtonElement;
  key: HTMLElement;
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
  private aimIndex = -1;
  /** The key map and aim mode the key caps and aim text were last drawn for (redrawn only on a change). */
  private shownKeys: KeyMap | null = null;
  private shownAim = -1;
  private aimTimer = 0;
  private digits = 3;
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
    aimCycle: byId('aimCycle'),
    slots: byId('slots'),
    aimGrid: byId('aimGrid'),
    aimHead: byId('aimHead'),
    aim: byId('aimGrid').parentElement!,
    touchDash: byId('btnDash'),
    touchRelease: byId('btnRelease'),
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly sink: CommandSink,
    private readonly keys: () => KeyMap,
  ) {
    this.el.aimHead.addEventListener('click', () => this.el.aim.classList.toggle('open'));
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
    this.digits = Math.max(3, String(world.stats.enemyTotal).length);
    this.aimIndex = -1;
    this.shownKeys = null;
    this.el.pilotCode.textContent = P.frame.name;
    setText(this.el.enemyOf, `/${world.stats.enemyTotal}`);
    setText(this.el.allyOf, `/${world.stats.allyTotal}`);

    this.el.slots.innerHTML = '';
    this.slots = P.slots.map((slot, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = 'slot';
      const label = slotLabel(world.catalog, slot.def);
      b.innerHTML = `<span class="k"><kbd></kbd> ${label}</span><span class="n"></span><span class="a"></span><i class="p"></i>`;
      b.querySelector('.n')!.textContent = dataText.weaponName(slot.def);
      b.addEventListener('click', () => this.sink.selectSlot(i));
      this.el.slots.appendChild(b);
      return { root: b, key: b.querySelector('kbd')!, amount: b.querySelector<HTMLElement>('.a')!, progress: b.querySelector<HTMLElement>('.p')! };
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
    setHtml(el.enemy, readoutHtml(remaining, this.digits));
    el.enemyBar.style.transform = `scaleX(${remaining / s.enemyTotal})`;
    setText(el.reserve, s.enemyQueue.length ? t('hud.reserve', { n: s.enemyQueue.length }) : t('hud.noReserve'));
    const allies = Math.max(0, s.allyAlive);
    setHtml(el.ally, readoutHtml(allies, 3));
    el.allyBar.style.transform = `scaleX(${allies / s.allyTotal})`;
    const breaking = world.catalog.battle.alerts.breakingAllies;
    setText(el.allySub, allies <= 0 ? t('hud.lineFallen') : allies < breaking ? t('hud.lineBreaking') : t('hud.lineHolding'));
    setText(el.time, formatClock(world.status.over ? world.status.endAt : world.t));
    setHtml(el.kills, readoutHtml(s.kills, this.digits));

    const hpFrac = Math.max(0, P.hp / P.maxHp);
    el.hp.style.transform = `scaleX(${hpFrac})`;
    this.renderHpLoss(Math.max(0, P.hp), P.maxHp);
    el.hpWrap.classList.toggle('low', hpFrac < world.catalog.battle.alerts.criticalHp);
    setHtml(el.hpText, `<b>${Math.max(0, Math.ceil(P.hp))}</b><small>${t('hud.hpOf', { max: P.maxHp })}</small>`);
    const dashReady = P.dashCd <= 0;
    // The key part is hidden on touch screens (.ck).
    setHtml(el.dash, dashReady ? `${t('hud.dash')}<span class="ck"> · ${escapeHtml(this.keys().label('dash'))}</span>` : t('hud.dashIn', { s: P.dashCd.toFixed(1) }));
    el.dash.classList.toggle('ready', dashReady);
    this.renderRelease(world, P);

    P.slots.forEach((slot, i) => {
      const view = this.slots[i];
      if (!view) return;
      let progress: number;
      let label: string;
      let reloading = false;
      if (slot.reloadT > 0) {
        label = t('hud.reloading');
        progress = 1 - slot.reloadT / slot.reloadTotal;
        reloading = true;
      } else if (slot.def.mag === null) {
        label = '∞';
        progress = 1;
      } else {
        label = `${slot.ammo} / ${slot.def.mag}`;
        progress = slot.ammo / slot.def.mag;
      }
      setText(view.amount, label);
      view.progress.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
      view.root.classList.toggle('active', i === P.active);
      view.root.classList.toggle('reloading', reloading);
    });
    this.aimButtons.forEach((b, i) => b.classList.toggle('on', i === world.aim.index));
    this.flashAimOnChange(world);
    const map = this.keys();
    if (map !== this.shownKeys || world.aim.index !== this.shownAim) {
      this.shownKeys = map;
      this.shownAim = world.aim.index;
      this.renderKeysAndAim(world, map);
    }
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
      text = t('hud.fullArmsLeft', { s: Math.max(0, P.release.duration - P.release.elapsed).toFixed(1) });
    } else if (ready) {
      const r = world.catalog.battle.player.superRelease.charge.closeRadius;
      let close = 0;
      for (const u of world.units) {
        if (u.team === ENEMY && u.kind === 'soldier' && u.alive && Math.abs(u.x - P.x) <= r && Math.hypot(u.x - P.x, u.y - P.y) <= r) close++;
      }
      const key = `<span class="ck"> · ${escapeHtml(this.keys().label('release'))}</span>`;
      text = close > 0 ? `${t('hud.fullArms')}${key} · ${t('hud.close', { n: close })}` : `${t('hud.fullArmsReady')}${key}`;
    } else {
      text = t('hud.fullArmsCharge', { pct: Math.floor(P.releaseCharge * 100) });
    }
    setHtml(chip, text);
    chip.style.setProperty('--fill', `${Math.round((P.release ? 1 : P.releaseCharge) * 100)}%`);
    chip.classList.toggle('ready', ready);
    if (ready && !this.releaseWasReady) replayAnimation(chip, 'ping');
    this.releaseWasReady = ready;
    chip.classList.toggle('active', !!P.release);
    chip.classList.toggle('charging', !ready && !P.release);
  }

  /** The hardpoints' key caps and the aim header and button, for the current bindings and aim mode. */
  private renderKeysAndAim(world: World, map: KeyMap): void {
    this.slots.forEach((view, i) => setText(view.key, map.label(slotAction(i))));
    const aim = dataText.aimName(world.catalog.aimModes[world.aim.index]!);
    setHtml(this.el.aimHead, `<span>${t('hud.aim')}</span><b>${aim}</b>${kbdHtml([map.label('aimPrev'), map.label('aimNext')])}`);
    setText(this.el.aimCycle, `${t('hud.aimCycle', { aim })} ›`);
  }

  /** The full aim grid opens for a moment when the mode changes (or stays open after a click on the header). */
  private flashAimOnChange(world: World): void {
    if (this.aimIndex !== world.aim.index) {
      const first = this.aimIndex < 0;
      this.aimIndex = world.aim.index;
      if (!first) {
        this.el.aim.classList.add('flash');
        clearTimeout(this.aimTimer);
        this.aimTimer = window.setTimeout(() => this.el.aim.classList.remove('flash'), AIM_OPEN_MS);
      }
    }
  }

  /** Dash or super release pressed before it was ready: the chip (and touch button) shakes and flashes. */
  denyAction(action: 'dash' | 'release'): void {
    const chip = action === 'dash' ? this.el.dash : this.el.release;
    const button = action === 'dash' ? this.el.touchDash : this.el.touchRelease;
    replayAnimation(chip, 'denied');
    replayAnimation(button, 'denied');
  }
}
