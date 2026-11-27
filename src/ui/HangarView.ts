import type { Catalog } from '../data/catalog';
import { FRAME_STATS, type FrameStat, type WeaponBehaviorName, type WeaponDef } from '../data/types';
import { medalFor, nextMedal, type Career } from '../game/career';
import { filledSlots, NAME_MAX, type LoadoutEditor } from '../game/loadout';
import { rankLetter } from '../game/rating';
import { formatNumber, t, tm } from '../i18n';
import { dataText } from '../i18n/data';
import { statText } from './frameText';
import { controlGroups, type ControlGroup } from './controls';
import type { KeyMap } from '../input/keymap';
import { armorLine, damageTypeBadge, listOf, matchupLine, slotLabel, unitTraitLines, unitWeaponLine, medalBadge } from './damageText';
import { byId, escapeHtml, kbdHtml, replayAnimation } from './dom';

export interface HangarModel {
  readonly catalog: Catalog;
  readonly editor: LoadoutEditor;
  /** The career so far (weapon kills for medals). */
  readonly career: () => Career;
  /** The current key bindings (the controls strip). */
  readonly keys: () => KeyMap;
}

/** The pre-battle screen: hardpoints, frame build, aim mode and enemy count. Edits go to the LoadoutEditor. */
export class HangarView {
  private readonly el = {
    build: byId('build'),
    ptCount: byId('ptCount'),
    aceName: byId<HTMLInputElement>('aceName'),
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
    armyBest: byId('armyBest'),
    releaseHint: byId('releaseHint'),
    keyStrip: byId('keyStrip'),
    guideCount: byId('guideCount'),
    summary: byId('summary'),
    launch: byId<HTMLButtonElement>('btnLaunch'),
  };

  constructor(
    private readonly root: HTMLElement,
    private model: HangarModel,
    /** Called after every edit (the app saves the loadout). */
    private readonly onChange: () => void,
    private readonly onLaunch: () => void,
    onOptions: () => void,
  ) {
    byId('btnOptions').addEventListener('click', onOptions);
    root.addEventListener('click', (e) => this.onClick(e));
    this.el.enemyCount.addEventListener('input', () => {
      this.model.editor.setEnemies(Number(this.el.enemyCount.value));
      this.onChange();
      this.renderArmy();
      this.renderSummary();
    });
    this.el.launch.addEventListener('click', () => this.onLaunch());
    this.el.aceName.maxLength = NAME_MAX;
    this.el.aceName.addEventListener('input', () => {
      this.model.editor.setName(this.el.aceName.value);
      this.onChange();
      this.renderSummary();
    });
    // Leaving the field shows the cleaned name (or the default, if it was left empty).
    this.el.aceName.addEventListener('change', () => {
      this.el.aceName.value = this.model.editor.value.name;
    });
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
    this.renderBuild();

    this.el.aims.innerHTML = catalog.aimModes
      .map((m) => `<button type="button" class="aim-opt" data-aim="${m.id}" aria-pressed="${sel.aim === m.id}"><b>${dataText.aimName(m)}</b><span>${dataText.aimDesc(m)}</span></button>`)
      .join('');

    const slotCount = editor.slotCount;
    this.el.loadSlots.innerHTML = Array.from({ length: slotCount }, (_, i) => {
      const id = sel.slots[i];
      const def = id ? catalog.weapon(id) : null;
      const key = t('hangar.slot.key', { n: i + 1 });
      return def
        ? `<button type="button" class="lslot filled" data-remove="${def.id}" aria-label="${escapeHtml(t('hangar.slot.remove', { weapon: dataText.weaponName(def), n: i + 1 }))}"><span class="k">${key} · ${slotLabel(catalog, def)}</span><span class="n">${dataText.weaponName(def)}</span></button>`
        : `<div class="lslot"><span class="k">${key}</span><span class="n">${t('hangar.slot.empty')}</span></div>`;
    }).join('');
    this.el.hpCount.textContent = `${filledSlots(sel).length} / ${slotCount}`;

    const career = this.model.career();
    const card = (def: WeaponDef) => {
      const idx = sel.slots.indexOf(def.id);
      return `<button type="button" class="arm" data-arm="${def.id}" aria-pressed="${idx >= 0}">
        <span class="no">${idx >= 0 ? idx + 1 : ''}</span>
        <span class="tag">${damageTypeBadge(catalog, def.damageType)}</span>
        <span class="an">${dataText.weaponName(def)}</span>
        <span class="as">${describeWeapon(def)}</span>
        <span class="am">${matchupLine(catalog, def.damageType)}</span>
        <span class="ad">${dataText.weaponDesc(def)}</span>
        ${medalLine(career.kills[def.id] ?? 0, catalog.loadout.medals)}
      </button>`;
    };
    // The arsenal, a row per damage type (with its trait).
    this.el.arsenal.innerHTML = catalog.damageTypes
      .map((type) => {
        const defs = catalog.weapons.filter((w) => w.damageType === type.id);
        return defs.length ? `<p class="arow dt-${type.id}"><b>${dataText.damageName(type)}</b><span>${dataText.damageTrait(type)}</span></p>${defs.map(card).join('')}` : '';
      })
      .join('');

    this.el.legend.innerHTML = catalog.classes
      .map(
        (c) =>
          `<li><span class="glyph g-${c.enemyShape ?? c.shape}"></span><b>${dataText.unitName(c)}</b><span class="lb">${dataText.unitBlurb(c)}</span><span class="lw">${unitWeaponLine(catalog, c)}</span>${unitTraitLines(c).map((line) => `<span class="lw">${line}</span>`).join('')}<span class="la">${armorLine(catalog, c.armor)}</span></li>`,
      )
      .join('');

    this.el.guideCount.textContent = t('hangar.guideCount', { n: catalog.classes.length });
    this.renderKeys();

    const release = catalog.battle.player.superRelease;
    this.el.releaseHint.textContent = t('hangar.releaseHint', { seconds: release.duration, cut: Math.round((1 - release.damageTakenMul) * 100) });

    const { min, max, step } = catalog.loadout.enemyCount;
    Object.assign(this.el.enemyCount, { min: String(min), max: String(max), step: String(step), value: String(sel.enemies) });
    this.renderArmy();
    this.renderSummary();
  }

  /** The controls as one strip of key caps, from the current bindings. */
  renderKeys(): void {
    const map = this.model.keys();
    const groups: ControlGroup[] = [...controlGroups(map, this.model.catalog.loadout.slots), { id: 'pause', keys: [map.label('pause')], label: t('keys.pause') }];
    this.el.keyStrip.innerHTML = groups
      .map((g) => `<span class="kg${g.id === 'release' ? ' release' : ''}">${kbdHtml(g.keys)}<span>${g.label}</span></span>`)
      .join('');
  }

  /** The frame build: points left, a row per stat (− / segments / +), presets; and the ALTER's name. */
  private renderBuild(): void {
    const { catalog, editor } = this.model;
    const fb = catalog.frameBuild;
    const build = editor.value.build;
    const left = editor.pointsLeft;
    this.el.ptCount.textContent = t('hangar.points', { left, total: fb.points });
    const rows = FRAME_STATS.map((s) => {
      const n = build[s];
      const label = dataText.statLabel(catalog, s);
      const segs = Array.from({ length: fb.maxPerStat }, (_, i) => `<i data-stat="${s}" data-level="${i + 1}"${i < n ? ' class="on"' : ''}></i>`).join('');
      return `<div class="brow"><span class="ml">${label}</span>
        <button type="button" class="bstep" data-stat="${s}" data-step="-1" aria-label="${escapeHtml(t('hangar.stat.take', { stat: label }))}"${n <= 0 ? ' disabled' : ''}>−</button>
        <span class="segs bsegs">${segs}</span>
        <button type="button" class="bstep" data-stat="${s}" data-step="1" aria-label="${escapeHtml(t('hangar.stat.add', { stat: label }))}"${n >= fb.maxPerStat || left <= 0 ? ' disabled' : ''}>+</button>
        <span class="mv">${statText(s, catalog.frameStat(s, n))}</span></div>`;
    }).join('');
    const presets = fb.presets.map((p) => `<button type="button" class="btn-mini" data-preset="${p.name}">${dataText.presetName(p.name)}</button>`).join('');
    this.el.build.innerHTML = `${rows}<div class="presets"><span>${t('hangar.presets')}</span>${presets}</div>`;
    // Don't overwrite the name while the player is typing it.
    if (document.activeElement !== this.el.aceName) this.el.aceName.value = editor.value.name;
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
    this.el.deployNote.textContent = t('hangar.deployNote', { initial: Math.min(enemies, initial), reserve, battalion });

    const career = this.model.career();
    const best = career.best[String(enemies)];
    const furthest = career.furthest[String(enemies)];
    this.el.armyBest.innerHTML =
      best !== undefined
        ? t('hangar.record.best', { enemies, score: formatNumber(best), rank: rankLetter(best / enemies, catalog.battle.rating.ranks) })
        : furthest !== undefined
          ? t('hangar.record.furthest', { enemies, pct: Math.floor(furthest * 100) })
          : t('hangar.record.none', { enemies });
  }

  /** Launch pressed with a loadout that can't launch: the button shakes, and the problem and empty hardpoints flash. */
  denyLaunch(): void {
    replayAnimation(this.el.launch, 'denied');
    const err = this.el.summary.querySelector<HTMLElement>('.err');
    if (err) replayAnimation(err, 'denied');
    const empty = [...this.el.loadSlots.querySelectorAll<HTMLElement>('.lslot:not(.filled)')];
    for (const slot of empty) replayAnimation(slot, 'denied');
    (empty[0] ?? this.el.loadSlots).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private renderSummary(error?: string): void {
    const { catalog, editor } = this.model;
    const sel = editor.value;
    const left = editor.pointsLeft;
    const check = editor.check();
    const names = filledSlots(sel).map((id) => dataText.weaponName(catalog.weapon(id)));
    const aim = dataText.aimName(catalog.aimModes[catalog.aimModeIndex(sel.aim)]!);
    const message = error ?? (check.ok ? '' : tm(check.message));
    const unspent = left > 0 ? ` · <span class="warn">${left === 1 ? t('hangar.summary.unspentOne') : t('hangar.summary.unspent', { n: left })}</span>` : '';
    this.el.summary.innerHTML =
      `<b>${escapeHtml(sel.name)}</b> · ${names.length ? listOf(names) : t('hangar.summary.noWeapons')} · ${t('hangar.summary.aim', { aim })} · ${t('hangar.summary.versus', { allies: catalog.armies.battle.allies.count, enemies: sel.enemies })}` +
      unspent +
      (message ? `<br><span class="err">${message}</span>` : '');
    // Not disabled: pressing it while the loadout can't launch shows why (denyLaunch).
    this.el.launch.setAttribute('aria-disabled', String(!check.ok));
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as Element;
    const { editor } = this.model;
    const step = target.closest<HTMLElement>('[data-step]');
    if (step) return this.edit(() => editor.adjust(step.dataset.stat as FrameStat, Number(step.dataset.step)));
    const level = target.closest<HTMLElement>('[data-level]');
    if (level) {
      const stat = level.dataset.stat as FrameStat;
      const n = Number(level.dataset.level);
      // Clicking the top filled segment takes that point back.
      return this.edit(() => editor.setPoints(stat, editor.value.build[stat] === n ? n - 1 : n));
    }
    const preset = target.closest<HTMLElement>('[data-preset]');
    if (preset) return this.edit(() => editor.applyPreset(preset.dataset.preset!));
    const aim = target.closest<HTMLElement>('[data-aim]');
    if (aim) return this.edit(() => editor.setAim(aim.dataset.aim!));
    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove) return this.edit(() => editor.remove(remove.dataset.remove!));
    const arm = target.closest<HTMLElement>('[data-arm]');
    if (arm) {
      const id = arm.dataset.arm!;
      if (editor.toggle(id) === 'full') {
        this.renderSummary(t('hangar.full', { n: editor.slotCount }));
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

type DamageText = { readonly [B in WeaponBehaviorName]: (w: Extract<WeaponDef, { behavior: B }>) => string };

/** A weapon card's medal line: the medal earned (if any), career kills, and the next medal. */
function medalLine(kills: number, medals: Catalog['loadout']['medals']): string {
  const now = medalFor(kills, medals);
  const next = nextMedal(kills, medals);
  const parts = [
    now ? medalBadge(now.name) : '',
    t('hangar.medal.kills', { n: kills }),
    next ? t('hangar.medal.next', { medal: dataText.medalName(next.name), kills: next.kills }) : t('hangar.medal.all'),
  ];
  return `<span class="medal">${parts.filter(Boolean).join(' · ')}</span>`;
}

/** How each weapon behavior states its damage on a card. TypeScript insists on one per behavior. */
const DAMAGE_TEXT: DamageText = {
  bullet: (w) => t('weapon.stat.dmg', { n: w.dmg }),
  beam: (w) => t('weapon.stat.dmg', { n: w.dmg }),
  rail: (w) =>
    w.steady
      ? t('weapon.stat.dmgRange', { min: Math.round(w.dmg * w.steady.moving), max: Math.round(w.dmg * w.steady.still * w.steady.fullBonus) })
      : t('weapon.stat.dmg', { n: w.dmg }),
  sniper: (w) => t('weapon.stat.dmg', { n: w.dmg }),
  missile: (w) => (w.salvo > 1 ? t('weapon.stat.dmgMulti', { dmg: w.dmg, n: w.salvo }) : `${t('weapon.stat.dmg', { n: w.dmg })} · ${t('weapon.stat.blast', { n: w.splashDmg })}`),
  shotgun: (w) => t('weapon.stat.dmgMulti', { dmg: w.dmg, n: w.pellets }),
  mortar: (w) => t('weapon.stat.blast', { n: w.splashDmg }),
  saber: (w) => t('weapon.stat.dmg', { n: w.dmg }),
};

/** The stat line under each arsenal card. */
export function describeWeapon(def: WeaponDef): string {
  const mag = def.mag === null ? '∞' : def.mag;
  const dmg = (DAMAGE_TEXT[def.behavior] as (w: WeaponDef) => string)(def);
  const ammo = t('weapon.stat.mag', { n: mag }) + (def.reload ? ` · ${t('weapon.stat.reload', { n: def.reload })}` : '');
  return `${dmg} · ${t('weapon.stat.range', { n: def.range })}<br>${ammo}`;
}
