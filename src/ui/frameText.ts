import type { FrameStat } from '../data/types';
import { t } from '../i18n';

/**
 * A frame stat's value in numbers only, the same in every language: speed and HP whole, reload
 * and fire rate as a change from the base frame ("−28%", "+11%"; null at base), dash in seconds.
 */
export function statNumber(stat: FrameStat, v: number): string | null {
  switch (stat) {
    case 'speed':
    case 'hp':
      return `${Math.round(v)}`;
    case 'reload':
      return v >= 1 ? null : `−${Math.round((1 - v) * 100)}%`;
    case 'fireRate':
      return v >= 1 ? null : `+${Math.round((1 / v - 1) * 100)}%`;
    case 'dash':
      return v.toFixed(1);
  }
}

/** A frame stat's value as the hangar shows it, with its unit in the current language. */
export function statText(stat: FrameStat, v: number): string {
  const n = statNumber(stat, v);
  if (n === null) return t('stat.value.base');
  if (stat === 'hp') return t('stat.value.hp', { n });
  if (stat === 'dash') return t('stat.value.seconds', { n });
  return n;
}
