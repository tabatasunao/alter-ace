import { formatClock } from '../core/math';
import type { World } from '../sim/World';
import type { SortieRecord } from '../game/career';
import { rateSortie, type SortieRating } from '../game/rating';
import { byId } from './dom';

/** How long the score counts up, in milliseconds. */
const COUNT_UP_MS = 700;

/** The end-of-sortie card: outcome, rating with its factors and best score, stats, kills per weapon and medals earned. */
export class ResultView {
  private countUp = 0;

  constructor(
    private readonly root: HTMLElement,
    actions: { onAgain: () => void; onHangar: () => void },
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

    byId('rEyebrow').textContent = win ? 'Mission complete' : 'Mission failed';
    byId('rTitle').textContent = win ? 'Enemy army destroyed' : 'Your ALTER was destroyed';
    byId('rRank').textContent = rating ? rating.letter : '–';
    byId('rRankWrap').classList.toggle('fail', !rating);
    const text = byId('rRankText');
    if (rating) {
      text.innerHTML = `<b>Rating <span class="score">0</span></b>${factorRows(world, rating)}${bestLine(s.enemyTotal, rating, record)}`;
      this.animateScore(text.querySelector<HTMLElement>('.score')!, rating.score);
    } else {
      text.innerHTML = `<b>No rating</b>${remaining} enemy ALTERs were still in the field.`;
    }

    const stats: [string, string][] = [
      ['Time', formatClock(world.status.endAt)],
      ['Your kills', `${s.kills}`],
      ['Enemy left', `${remaining} / ${s.enemyTotal}`],
      ['Allies alive', `${Math.max(0, s.allyAlive)} / ${s.allyTotal}`],
      ['Damage taken', `${Math.round(s.dmgTaken)}`],
      ['Close dodges', `${s.dodges}`],
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

    const weapons = world.player!.slots.filter((slot) => slot.kind === 'weapon').map((slot) => [slot.def.name, s.killsBy[slot.def.id] ?? 0] as const);
    const max = Math.max(1, ...weapons.map(([, n]) => n));
    const list = byId('rWeapons');
    list.innerHTML = '<h3>Kills by weapon</h3>';
    for (const [name, n] of weapons) {
      const row = document.createElement('div');
      row.className = 'wk';
      row.innerHTML = `<span></span><span class="bar"><i style="width:${(n / max) * 100}%"></i></span><span class="v">${n}</span>`;
      row.firstElementChild!.textContent = name;
      list.appendChild(row);
    }
    if (record.medals.length) {
      const h = document.createElement('h3');
      h.textContent = 'Medals earned';
      list.appendChild(h);
      for (const { weapon, medal } of record.medals) {
        const row = document.createElement('p');
        row.className = 'medal-won';
        row.innerHTML = `<b class="m-${medal.name.toLowerCase()}">★ ${medal.name}</b> <span></span>`;
        row.lastElementChild!.textContent = `${world.catalog.armament(weapon).name} · ${record.career.kills[weapon] ?? 0} career kills`;
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
      el.textContent = Math.round(score * (1 - (1 - k) ** 3)).toLocaleString('en-US');
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
    ['Pace', r.pace, `${formatClock(world.status.endAt)} · par ${formatClock(r.par)}`],
    ['Integrity', r.integrity, `took ${(s.dmgTaken / maxHp).toFixed(1)}× your HP`],
    ['Allied line', r.line, `${Math.max(0, s.allyAlive)} of ${s.allyTotal} alive`],
  ];
  return `<span class="factors">${rows.map(([name, k, why]) => `<span><i>${name}</i> ×${k.toFixed(2)} <em>${why}</em></span>`).join('')}</span>`;
}

/** A new best for this army size, or the best to beat. */
function bestLine(enemies: number, r: SortieRating, record: SortieRecord): string {
  if (record.newBest) {
    const was = record.previousBest === null ? '' : ` (was ${record.previousBest.toLocaleString('en-US')})`;
    return `<span class="best new">New best against ${enemies}${was}</span>`;
  }
  const best = record.previousBest ?? r.score;
  return `<span class="best">Best against ${enemies}: ${best.toLocaleString('en-US')}</span>`;
}
