import { clamp, formatClock } from '../core/math';
import type { CommandSink } from '../input/commands';
import type { Status } from '../sim/entities';
import type { World } from '../sim/World';
import { slotLabel } from './damageText';
import { byId, replayAnimation, setText } from './dom';

interface SlotElements {
  root: HTMLButtonElement;
  amount: HTMLElement;
  progress: HTMLElement;
}

/** The battle HUD: army counts, clock, pilot status, hardpoints and aim mode buttons. */
export class HudView {
  private slots: SlotElements[] = [];
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
    el.hpWrap.classList.toggle('low', hpFrac < world.catalog.battle.alerts.criticalHp);
    setText(el.hpText, `${Math.max(0, Math.ceil(P.hp))} / ${P.maxHp} HP`);
    const dashReady = P.dashCd <= 0;
    setText(el.dash, dashReady ? 'Dash ready' : `Dash ${P.dashCd.toFixed(1)}`);
    el.dash.classList.toggle('ready', dashReady);
    const releaseReady = P.releaseCd <= 0;
    setText(el.release, releaseReady ? 'Release ready' : `Release ${P.releaseCd.toFixed(1)}`);
    el.release.classList.toggle('ready', releaseReady);
    this.renderStatuses(P.statuses);

    P.slots.forEach((slot, i) => {
      const view = this.slots[i];
      if (!view) return;
      let progress: number;
      let label: string;
      let reloading = false;
      let ready = false;
      if (slot.kind === 'weapon') {
        if (slot.reloadT > 0) {
          label = 'Reloading';
          progress = 1 - slot.reloadT / slot.reloadTotal;
          reloading = true;
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
