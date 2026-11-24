import { formatClock } from '../core/math';
import type { World } from '../sim/World';
import { rateSortie } from '../game/rating';
import { byId } from './dom';

/** The end-of-sortie card: outcome, rating, stats and kills per weapon. */
export class ResultView {
  constructor(
    private readonly root: HTMLElement,
    actions: { onAgain: () => void; onHangar: () => void },
  ) {
    byId('btnAgain').addEventListener('click', actions.onAgain);
    byId('btnHangar').addEventListener('click', actions.onHangar);
  }

  hide(): void {
    this.root.hidden = true;
  }

  show(world: World): void {
    this.root.hidden = false;
    const s = world.stats;
    const win = world.status.win;
    const { share, letter } = rateSortie(world);
    const remaining = world.enemiesLeft;
    const topRank = world.catalog.battle.ranks[0]!;

    byId('rEyebrow').textContent = win ? 'Mission complete' : 'Mission failed';
    byId('rTitle').textContent = win ? 'Enemy army destroyed' : 'Your ALTER was destroyed';
    byId('rRank').textContent = win ? letter : '–';
    byId('rRankWrap').classList.toggle('fail', !win);
    byId('rRankText').innerHTML = win
      ? `<b>Ace rating</b>You destroyed ${Math.round(share * 100)}% of the enemy army yourself. ${topRank.letter} needs ${Math.round(topRank.minShare * 100)}%.`
      : `<b>No rating</b>${remaining} enemy ALTERs were still in the field.`;

    const stats: [string, string][] = [
      ['Time', formatClock(world.status.endAt)],
      ['Your kills', `${s.kills}`],
      ['Enemy left', `${remaining} / ${s.enemyTotal}`],
      ['Allies alive', `${Math.max(0, s.allyAlive)} / ${s.allyTotal}`],
      ['Damage taken', `${Math.round(s.dmgTaken)}`],
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
  }
}
