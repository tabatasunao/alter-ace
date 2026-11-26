import { clamp } from '../core/math';
import type { Catalog } from '../data/catalog';
import { isWeapon, type ArmamentDef, type FrameDef, type WeaponBehaviorName, type WeaponDef } from '../data/types';
import { medalFor, nextMedal, type Career } from '../game/career';
import type { LoadoutEditor } from '../game/loadout';
import { armorLine, damageTypeBadge, matchupLine, slotLabel, unitTraitLines, unitWeaponLine } from './damageText';
import { byId } from './dom';

export interface HangarModel {
  readonly catalog: Catalog;
  readonly editor: LoadoutEditor;
  /** The career so far (weapon kills for medals). */
  readonly career: () => Career;
}

/** The pre-battle screen: frame, aim mode, enemy count and hardpoints. Edits go to the LoadoutEditor. */
export class HangarView {
  private readonly el = {
    frames: byId('frames'),
    aims: byId('aims'),
    loadSlots: byId('loadSlots'),
    hpCount: byId('hpCount'),
    arsenal: byId('arsenal'),
    legend: byId('legend'),
    enemyCount: byId<HTMLInputElement>('enemyCount'),
    enemyOut: byId('enemyOut'),
    vsAlly: byId('vsAlly'),
    vsEnemy: byId('vsEnemy'),
    deployNote: byId('deployNote'),
    releaseHint: byId('releaseHint'),
    summary: byId('summary'),
    launch: byId<HTMLButtonElement>('btnLaunch'),
  };

  constructor(
    private readonly root: HTMLElement,
    private model: HangarModel,
    /** Called after every edit (the app saves the loadout). */
    private readonly onChange: () => void,
    private readonly onLaunch: () => void,
  ) {
    root.addEventListener('click', (e) => this.onClick(e));
    this.el.enemyCount.addEventListener('input', () => {
      this.model.editor.setEnemies(Number(this.el.enemyCount.value));
      this.onChange();
      this.renderArmy();
      this.renderSummary();
    });
    this.el.launch.addEventListener('click', () => this.onLaunch());
  }

  setModel(model: HangarModel): void {
    this.model = model;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  render(): void {
    const { catalog, editor } = this.model;
    const sel = editor.value;
    const best = bestFrameStats(catalog.frames);

    this.el.frames.innerHTML = catalog.frames
      .map(
        (f) => `
      <button type="button" class="frame" data-frame="${f.id}" aria-pressed="${sel.frame === f.id}">
        <span class="fhead"><span class="fcode">${f.code}</span><span class="fname">${f.name}</span><span class="ftype">${f.type}</span></span>
        <span class="meters">${frameMeters(f, best)
          .map(([label, value, text]) => `<span class="meter"><span class="ml">${label}</span><span class="segs">${segments(value)}</span><span class="mv">${text}</span></span>`)
          .join('')}</span>
        <span class="fdesc">${f.desc}</span>
      </button>`,
      )
      .join('');

    this.el.aims.innerHTML = catalog.aimModes
      .map((m) => `<button type="button" class="aim-opt" data-aim="${m.id}" aria-pressed="${sel.aim === m.id}"><b>${m.name}</b><span>${m.desc}</span></button>`)
      .join('');

    const slotCount = editor.slotCount;
    this.el.loadSlots.innerHTML = Array.from({ length: slotCount }, (_, i) => {
      const id = sel.slots[i];
      const def = id ? catalog.armament(id) : null;
      return def
        ? `<button type="button" class="lslot filled" data-remove="${def.id}" aria-label="Remove ${def.name} from hardpoint ${i + 1}"><span class="k">Key ${i + 1} · ${slotLabel(catalog, def)}</span><span class="n">${def.name}</span></button>`
        : `<div class="lslot"><span class="k">Key ${i + 1}</span><span class="n">Empty</span></div>`;
    }).join('');
    this.el.hpCount.textContent = `${sel.slots.length} / ${slotCount}`;

    const career = this.model.career();
    this.el.arsenal.innerHTML = catalog.armaments
      .map((def) => {
        const idx = sel.slots.indexOf(def.id);
        const kind = isWeapon(def) ? 'weapon' : 'tool';
        const type = isWeapon(def) ? ` · ${damageTypeBadge(catalog, def.damageType)}` : '';
        const matchups = isWeapon(def) ? matchupLine(catalog, def.damageType) : '';
        return `<button type="button" class="arm" data-arm="${def.id}" aria-pressed="${idx >= 0}">
        <span class="no">${idx >= 0 ? idx + 1 : ''}</span>
        <span class="tag ${kind}">${kindLabel(def)}${type}</span>
        <span class="an">${def.name}</span>
        <span class="as">${describeArmament(def)}</span>
        ${matchups ? `<span class="am">${matchups}</span>` : ''}
        <span class="ad">${def.desc}</span>
        ${isWeapon(def) ? medalLine(career.kills[def.id] ?? 0, catalog.loadout.medals) : `<span class="ar"><b>Release</b> ${def.releaseDesc}</span>`}
      </button>`;
      })
      .join('');

    this.el.legend.innerHTML = catalog.classes
      .map(
        (c) =>
          `<li><span class="glyph g-${c.shape}"></span><b>${c.name}</b><span class="lb">${c.blurb}</span><span class="lw">${unitWeaponLine(catalog, c)}</span>${unitTraitLines(c).map((t) => `<span class="lw">${t}</span>`).join('')}<span class="la">${armorLine(catalog, c.armor)}</span></li>`,
      )
      .join('');

    const release = catalog.battle.player.superRelease;
    this.el.releaseHint.textContent = `Super release, when the gauge is full: a fireworks burst from every weapon, then every weapon hardpoint fires and every tool runs its release effect for ${release.duration} s, with ${Math.round((1 - release.damageTakenMul) * 100)}% less damage taken. Kills refill the gauge, close ones faster.`;

    const { min, max, step } = catalog.loadout.enemyCount;
    Object.assign(this.el.enemyCount, { min: String(min), max: String(max), step: String(step), value: String(sel.enemies) });
    this.renderArmy();
    this.renderSummary();
  }

  private renderArmy(): void {
    const { catalog, editor } = this.model;
    const enemies = editor.value.enemies;
    const { initial } = catalog.armies.battle.enemies;
    const { battalion } = catalog.armies.reinforcements;
    this.el.enemyOut.textContent = String(enemies);
    this.el.vsEnemy.textContent = String(enemies);
    this.el.vsAlly.textContent = String(catalog.armies.battle.allies.count);
    const reserve = Math.max(0, enemies - initial);
    this.el.deployNote.textContent = `${Math.min(enemies, initial)} deploy at the start. The other ${reserve} arrive from the east in waves of up to ${battalion}.`;
  }

  private renderSummary(error?: string): void {
    const { catalog, editor } = this.model;
    const sel = editor.value;
    const frame = catalog.frame(sel.frame);
    const check = editor.check();
    const names = sel.slots.map((id) => catalog.armament(id).name).join(', ') || 'no hardpoints';
    const aim = catalog.aimModes[catalog.aimModeIndex(sel.aim)]!.name;
    const message = error ?? (check.ok ? '' : check.message);
    this.el.summary.innerHTML =
      `<b>${frame.code} ${frame.name}</b> · ${names} · Aim: ${aim} · 1 + ${catalog.armies.battle.allies.count} vs ${sel.enemies}` +
      (message ? `<br><span class="err">${message}</span>` : '');
    this.el.launch.disabled = !check.ok;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as Element;
    const { editor } = this.model;
    const frame = target.closest<HTMLElement>('[data-frame]');
    if (frame) return this.edit(() => editor.setFrame(frame.dataset.frame!));
    const aim = target.closest<HTMLElement>('[data-aim]');
    if (aim) return this.edit(() => editor.setAim(aim.dataset.aim!));
    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove) return this.edit(() => editor.remove(remove.dataset.remove!));
    const arm = target.closest<HTMLElement>('[data-arm]');
    if (arm) {
      const id = arm.dataset.arm!;
      if (editor.toggle(id) === 'full') {
        this.renderSummary(`All ${editor.slotCount} hardpoints are full. Remove one first.`);
        return;
      }
      this.onChange();
      this.render();
      this.root.querySelector<HTMLElement>(`[data-arm="${id}"]`)?.focus({ preventScroll: true });
    }
  }

  private edit(change: () => void): void {
    change();
    this.onChange();
    this.render();
  }
}

function kindLabel(def: ArmamentDef): string {
  return isWeapon(def) ? 'Weapon' : 'Tool';
}

type DamageText = { readonly [B in WeaponBehaviorName]: (w: Extract<WeaponDef, { behavior: B }>) => string };

/** A weapon card's medal line: the medal earned (if any), career kills, and the next medal. */
function medalLine(kills: number, medals: Catalog['loadout']['medals']): string {
  const now = medalFor(kills, medals);
  const next = nextMedal(kills, medals);
  const parts = [now ? `<b class="m-${now.name.toLowerCase()}">★ ${now.name}</b>` : '', `${kills} kills`, next ? `${next.name} at ${next.kills}` : 'every medal earned'];
  return `<span class="medal">${parts.filter(Boolean).join(' · ')}</span>`;
}

/** How each weapon behavior states its damage on a card. TypeScript insists on one per behavior. */
const DAMAGE_TEXT: DamageText = {
  bullet: (w) => `DMG ${w.dmg}`,
  beam: (w) => `DMG ${w.dmg}`,
  rail: (w) => (w.steady ? `DMG ${Math.round(w.dmg * w.steady.moving)}–${Math.round(w.dmg * w.steady.still)}` : `DMG ${w.dmg}`),
  missile: (w) => `DMG ${w.dmg}×${w.salvo}`,
  breach: (w) => `DMG ${w.dmg}×${w.pellets} · Blast ${w.blast.dmg}`,
  mortar: (w) => `Blast ${w.splashDmg}`,
  saber: (w) => `DMG ${w.dmg}`,
};

/** The stat line under each arsenal card. */
export function describeArmament(def: ArmamentDef): string {
  if (!isWeapon(def)) return `Recharge ${def.cooldown} s`;
  const mag = def.mag === null ? '∞' : def.mag;
  const dmg = (DAMAGE_TEXT[def.behavior] as (w: WeaponDef) => string)(def);
  const ammo = def.heat ? `Heat ${mag} shots · Overheat ${def.reload} s` : `Mag ${mag}${def.reload ? ` · Reload ${def.reload} s` : ''}`;
  return `${dmg} · Range ${def.range}<br>${ammo}`;
}

interface BestFrameStats {
  speed: number;
  hp: number;
  reloadMul: number;
  rateMul: number;
  dashCd: number;
}

function bestFrameStats(frames: readonly FrameDef[]): BestFrameStats {
  return {
    speed: Math.max(...frames.map((f) => f.speed)),
    hp: Math.max(...frames.map((f) => f.hp)),
    reloadMul: Math.min(...frames.map((f) => f.reloadMul)),
    rateMul: Math.min(...frames.map((f) => f.rateMul)),
    dashCd: Math.min(...frames.map((f) => f.dashCd)),
  };
}

/** [label, 0..1 bar value (best frame = full), text]. */
function frameMeters(f: FrameDef, best: BestFrameStats): [string, number, string][] {
  return [
    ['Speed', f.speed / best.speed, `${f.speed}`],
    ['HP', f.hp / best.hp, `${f.hp} HP`],
    ['Reload', best.reloadMul / f.reloadMul, f.reloadMul === 1 ? 'base' : `−${Math.round((1 - f.reloadMul) * 100)}%`],
    ['Fire rate', best.rateMul / f.rateMul, f.rateMul === 1 ? 'base' : `+${Math.round((1 / f.rateMul - 1) * 100)}%`],
    ['Dash', best.dashCd / f.dashCd, `${f.dashCd} s`],
  ];
}

function segments(value: number): string {
  const n = Math.round(clamp(value, 0, 1) * 10);
  let out = '';
  for (let i = 0; i < 10; i++) out += `<i class="${i < n ? 'on' : ''}"></i>`;
  return out;
}
