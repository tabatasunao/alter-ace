import { slotAction } from '../game/settings';
import { t } from '../i18n';
import type { KeyMap } from '../input/keymap';

/** One line of the controls help: what it does and its current keys. */
export interface ControlGroup {
  readonly id: 'move' | 'weapons' | 'aim' | 'dash' | 'release' | 'reload' | 'pause';
  readonly keys: readonly string[];
  readonly label: string;
}

/** The main controls with their current keys, in the order the hangar strip and the pause card list them. */
export function controlGroups(map: KeyMap, slotCount: number): ControlGroup[] {
  return [
    { id: 'move', keys: ['up', 'left', 'down', 'right'].map((a) => map.label(a)), label: t('keys.move') },
    { id: 'weapons', keys: Array.from({ length: slotCount }, (_, i) => map.label(slotAction(i))), label: t('keys.weapons') },
    { id: 'aim', keys: [map.label('aimPrev'), map.label('aimNext')], label: t('keys.aim') },
    { id: 'dash', keys: [map.label('dash')], label: t('keys.dash') },
    { id: 'release', keys: [map.label('release')], label: t('keys.fullArms') },
    { id: 'reload', keys: [map.label('reload')], label: t('keys.reload') },
  ];
}
