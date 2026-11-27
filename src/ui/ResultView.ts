import { medalBadge } from './damageText';
import { formatClock } from '../core/math';
import type { World } from '../sim/World';
import { medalProgress, type SortieRecord } from '../game/career';
import { nextRank, rateSortie, type SortieRating } from '../game/rating';
import { defeatTip } from '../game/tips';
import type { KeyMap } from '../input/keymap';
import { byId, escapeHtml } from './dom';
import { formatNumber, t, tm } from '../i18n';
import { dataText } from '../i18n/data';

/** How long the score counts up, in milliseconds. */
const COUNT_UP_MS = 700;

/**
 * The end-of-sortie card: outcome, rating with its factors, best score and next rank (won), or the
 * share of the army destroyed and a tip (lost); stats; kills per weapon with medal progress; medals earned.
 */
export class ResultView {
  private countUp = 0;

  constructor(
    private readonly root: HTMLElement,
    actions: { onAgain: () => void; onHangar: () => void },
    private readonly keys: () => KeyMap,
  ) {
    byId('btnAgain').addEventListener('click', actions.onAgain);
    byId('btnHangar').addEventListener('click', actions.onHangar);
  }

  hide(): void {
    this.root.hidden = true;
    cancelAnimationFrame(this.countUp);
  }

  show(world: World, record: SortieRecord): void {
    this.root.hidden = false;
    const s = world.stats;
    const win = world.status.win;
    const rating = rateSortie(world);
    const remaining = world.enemiesLeft;

    byId('rEyebrow').textContent = win ? t('result.complete') : t('result.failed');
    byId('rTitle').textContent = win ? t('result.winTitle') : t('result.lossTitle', { name: world.player!.frame.name });
    byId('rRank').textContent = rating ? rating.letter : '–';
    byId('rRankWrap').classList.toggle('fail', !rating);
    const text = byId('rRankText');
    const tip = byId('rTip');
    if (rating) {
      text.innerHTML = `<b>${t('result.rating')} <span class="score">0</span></b>${factorRows(world, rating)}${bestLine(s.enemyTotal, rating, record)}${nextRankLine(world, rating)}`;
      this.animateScore(text.querySelector<HTMLElement>('.score')!, rating.score);
      tip.hidden = true;
    } else {
      text.innerHTML = `<b>${t('result.noRating')}</b>${progressLine(record)}`;
      const map = this.keys();
      tip.innerHTML = `<b>${t('result.tip')}</b>${escapeHtml(tm(defeatTip({ world, key: (a) => map.label(a) })))}`;
      tip.hidden = false;
    }

    const stats: [string, string][] = [
      [t('result.stat.time'), formatClock(world.status.endAt)],
      [t('result.stat.kills'), `${s.kills}`],
      [t('result.stat.enemyLeft'), `${remaining} / ${s.enemyTotal}`],
      [t('result.stat.allies'), `${Math.max(0, s.allyAlive)} / ${s.allyTotal}`],
      [t('result.stat.damage'), `${Math.round(s.dmgTaken)}`],
      [t('result.stat.dodges'), `${s.dodges}`],
    ];
    const dl = byId('rStats');
    dl.innerHTML = '';
    for (const [label, value] of stats) {
      const d = document.createElement('div');
      d.innerHTML = '<dt></dt><dd></dd>';
      d.firstElementChild!.textContent = label;
      d.lastElementChild!.textContent = value;
      dl.appendChild(d);
    }

    const weapons = world.player!.slots.map((slot) => [slot.def.id, dataText.weaponName(slot.def), s.killsBy[slot.def.id] ?? 0] as const);
    const max = Math.max(1, ...weapons.map(([, , n]) => n));
    const medals = world.catalog.loadout.medals;
    const list = byId('rWeapons');
    list.innerHTML = `<h3>${t('result.killsByWeapon')}</h3>`;
    for (const [id, name, n] of weapons) {
      const career = record.career.kills[id] ?? 0;
      const p = medalProgress(career, medals);
      const goal = p.next
        ? t('result.medalTo', { kills: career, need: p.next.kills, medal: medalBadge(p.next.name, false) })
        : t('result.medalAll', { kills: career });
      const row = document.createElement('div');
      row.className = 'wk';
      row.innerHTML = `<span></span><span class="bar"><i style="width:${(n / max) * 100}%"></i></span><span class="v">${n}</span><span class="wm"><span class="mbar"><i style="width:${Math.round(p.share * 100)}%"></i></span><em>${goal}</em></span>`;
      row.firstElementChild!.textContent = name;
      list.appendChild(row);
    }
    if (record.medals.length) {
      const h = document.createElement('h3');
      h.textContent = t('result.medalsEarned');
      list.appendChild(h);
      for (const { weapon, medal } of record.medals) {
        const row = document.createElement('p');
        row.className = 'medal-won';
        row.innerHTML = `${medalBadge(medal.name)} <span></span>`;
        row.lastElementChild!.textContent = `${dataText.weaponName(world.catalog.weapon(weapon))} · ${t('result.careerKills', { n: record.career.kills[weapon] ?? 0 })}`;
        list.appendChild(row);
      }
    }
  }

  /** Counts the score up from 0, quickly, then settles on the exact value. */
  private animateScore(el: HTMLElement, score: number): void {
    cancelAnimationFrame(this.countUp);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_UP_MS);
      el.textContent = formatNumber(score * (1 - (1 - k) ** 3));
      if (k < 1) this.countUp = requestAnimationFrame(step);
    };
    this.countUp = requestAnimationFrame(step);
  }
}

/** The three factors behind the score, each with what drove it. */
function factorRows(world: World, r: SortieRating): string {
  const s = world.stats;
  const maxHp = world.player?.maxHp ?? 1;
  const rows: [string, number, string][] = [
    [t('result.factor.pace'), r.pace, t('result.factor.paceWhy', { time: formatClock(world.status.endAt), par: formatClock(r.par) })],
    [t('result.factor.integrity'), r.integrity, t('result.factor.integrityWhy', { x: (s.dmgTaken / maxHp).toFixed(1) })],
    [t('result.factor.line'), r.line, t('result.factor.lineWhy', { alive: Math.max(0, s.allyAlive), total: s.allyTotal })],
  ];
  return `<span class="factors">${rows.map(([name, k, why]) => `<span><i>${name}</i> ×${k.toFixed(2)} <em>${why}</em></span>`).join('')}</span>`;
}

/** The next rank and the score it takes at this army size, or the top rank. */
function nextRankLine(world: World, r: SortieRating): string {
  const next = nextRank(r.perEnemy, world.catalog.battle.rating.ranks);
  if (!next) return `<span class="next">${t('result.topRank')}</span>`;
  const score = Math.ceil(next.minScore * world.stats.enemyTotal);
  return `<span class="next">${t('result.nextRank', { rank: next.letter, score: formatNumber(score) })}</span>`;
}

/** A lost sortie: how much of the army fell, against the furthest so far at this army size. */
function progressLine(record: SortieRecord): string {
  const share = record.progress;
  const pct = (k: number) => `${Math.floor(k * 100)}%`;
  const was = record.previousFurthest;
  const note = was === null ? '' : record.newFurthest ? ` · ${t('result.progress.newBest', { was: pct(was) })}` : ` · ${t('result.progress.best', { best: pct(was) })}`;
  const mark = was === null ? '' : `<s style="left:${(was * 100).toFixed(1)}%"></s>`;
  return `<span class="progress"><span class="pbar"><i style="width:${(share * 100).toFixed(1)}%"></i>${mark}</span><span class="pv">${t('result.progress', { pct: pct(share) })}${note}</span></span>`;
}

/** A new best for this army size, or the best to beat. */
function bestLine(enemies: number, r: SortieRating, record: SortieRecord): string {
  if (record.newBest) {
    return `<span class="best new">${record.previousBest === null ? t('result.newBest', { enemies }) : t('result.newBestWas', { enemies, was: formatNumber(record.previousBest) })}</span>`;
  }
  const best = record.previousBest ?? r.score;
  return `<span class="best">${t('result.best', { enemies, score: formatNumber(best) })}</span>`;
}
