import { describe, expect, it, vi } from 'vitest';
import { defaultKeys, defaultSettings, rebind, sanitizeSettings } from '../src/game/settings';
import type { CommandSink, InputMode } from '../src/input/commands';
import { KeyboardInput } from '../src/input/KeyboardInput';
import { KeyMap, keyLabel } from '../src/input/keymap';
import { PlayerCommands } from '../src/sim/PlayerCommands';
import { arena, loadTestCatalog } from './helpers';

const AIM_KEYS = ['5', '6', '7', '8', '9', '0'];

describe('settings', () => {
  it('fall back to the defaults for anything storage got wrong', () => {
    expect(sanitizeSettings(null, 4)).toEqual(defaultSettings(4));
    expect(sanitizeSettings('junk', 4)).toEqual(defaultSettings(4));
    const s = sanitizeSettings({ shake: 7, flash: -1, hudScale: 2, keys: { dash: [3, 'k'], release: 'space' } }, 4);
    expect(s.shake).toBe(1);
    expect(s.flash).toBe(0);
    expect(s.hudScale).toBe(1);
    expect(s.keys.dash).toEqual(['k']);
    expect(s.keys.release).toEqual([' ']); // not a list: default kept
  });

  it('keep a key on the first action that names it, two keys at most', () => {
    const s = sanitizeSettings({ keys: { up: ['w', 'arrowup', 'i'], dash: ['w', 'k'] } }, 4);
    expect(s.keys.up).toEqual(['w', 'arrowup']);
    expect(s.keys.dash).toEqual(['k']);
    // An action missing from storage keeps its defaults, minus keys already taken.
    const t = sanitizeSettings({ keys: { up: ['shift'] } }, 4);
    expect(t.keys.dash).toEqual([]);
  });

  it('rebinding takes the key from the action that had it', () => {
    const keys = defaultKeys(4);
    const a = rebind(keys, 'dash', 0, ' ');
    expect(a.dash).toEqual([' ']);
    expect(a.release).toEqual([]);
    expect(keys.dash).toEqual(['shift']); // unchanged
    const b = rebind(a, 'dash', 1, 'k');
    expect(b.dash).toEqual([' ', 'k']);
    expect(rebind(b, 'dash', 0, null).dash).toEqual(['k']);
    expect(rebind(b, 'dash', 0, 'j').dash).toEqual(['j', 'k']);
  });
});

describe('key map', () => {
  it('labels keys the way the HUD shows them', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('arrowleft')).toBe('←');
    expect(keyLabel('q')).toBe('Q');
    expect(keyLabel('pagedown')).toBe('Pagedown');
    const map = new KeyMap(rebind(defaultKeys(4), 'dash', 0, null), AIM_KEYS);
    expect(map.label('release')).toBe('Space');
    expect(map.label('dash')).toBe('–');
    expect(map.labels('up')).toEqual(['W', '↑']);
  });

  it('looks up moves, hardpoints and aim keys; a bound key beats a data aim key', () => {
    const map = new KeyMap(rebind(defaultKeys(4), 'reload', 0, '5'), AIM_KEYS);
    expect(map.move('arrowleft')).toEqual([-1, 0]);
    expect(map.move('q')).toBeNull();
    expect(map.slot('3')).toBe(2);
    expect(map.slot('q')).toBe(-1);
    expect(map.aim('6')).toBe(1);
    expect(map.aim('5')).toBe(-1);
    expect(map.action('5')).toBe('reload');
  });
});

describe('keyboard flow', () => {
  function rig(mode: InputMode, keys = defaultKeys(4)) {
    const handlers: Record<string, (e: unknown) => void> = {};
    const target = { addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn) } as unknown as Window;
    const state = { mode };
    const sink = {
      inputMode: () => state.mode,
      selectSlot: vi.fn(),
      setAimIndex: vi.fn(),
      cycleAim: vi.fn(),
      dash: vi.fn(),
      superRelease: vi.fn(),
      reload: vi.fn(),
      zoomBy: vi.fn(),
      togglePause: vi.fn(),
      confirm: vi.fn(),
      back: vi.fn(),
    } satisfies CommandSink;
    const input = new KeyboardInput(sink, () => new KeyMap(keys, AIM_KEYS), target);
    const press = (key: string, repeat = false) => handlers.keydown!({ key, repeat, target: null, preventDefault: () => {} });
    return { sink, state, input, press, handlers };
  }

  it('launches from the hangar with Enter or Space', () => {
    const { sink, press } = rig('menu');
    press('Enter');
    press(' ');
    press(' ', true);
    press('Shift');
    expect(sink.confirm).toHaveBeenCalledTimes(2);
    expect(sink.dash).not.toHaveBeenCalled();
  });

  it('after a sortie, Esc goes back and any other key confirms; held keys do nothing', () => {
    const { sink, press } = rig('ended');
    press('x');
    press(' ');
    press(' ', true);
    press('Escape');
    expect(sink.confirm).toHaveBeenCalledTimes(2);
    expect(sink.back).toHaveBeenCalledTimes(1);
    expect(sink.togglePause).not.toHaveBeenCalled();
  });

  it('leaves keys to the options card while it is open', () => {
    const { sink, press } = rig('options');
    press('Escape');
    press(' ');
    expect(sink.togglePause).not.toHaveBeenCalled();
    expect(sink.superRelease).not.toHaveBeenCalled();
  });

  it('follows rebound keys in battle, and only pause works while paused', () => {
    const keys = rebind(defaultKeys(4), 'dash', 0, 'k');
    const { sink, state, input, press, handlers } = rig('playing', keys);
    press('Shift');
    press('k');
    expect(sink.dash).toHaveBeenCalledTimes(1);
    press('d');
    expect(input.read()).toEqual({ x: 1, y: 0 });
    handlers.keyup!({ key: 'd' });
    state.mode = 'paused';
    press('k');
    press('Escape');
    expect(sink.dash).toHaveBeenCalledTimes(1);
    expect(sink.togglePause).toHaveBeenCalledTimes(1);
  });
});

describe('denied actions', () => {
  const catalog = loadTestCatalog();

  it('report a dash on cooldown and a release before the gauge is full', () => {
    const world = arena(catalog);
    const denied: string[] = [];
    world.events.on('actionDenied', ({ action }) => denied.push(action));
    const P = world.player!;
    const commands = new PlayerCommands(world);
    P.dashCd = 1;
    commands.dash();
    P.releaseCharge = 0.5;
    commands.superRelease();
    expect(denied).toEqual(['dash', 'release']);
    P.releaseCharge = 1;
    commands.superRelease();
    expect(P.release).toBeTruthy();
    expect(denied).toHaveLength(2);
  });
});
