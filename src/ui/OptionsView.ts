import { actionLabel, HUD_SIZES, KEYS_PER_ACTION, rebind, type ActionId, type Settings } from '../game/settings';
import { keyLabel } from '../input/keymap';
import { byId, escapeHtml as esc } from './dom';
import { t } from '../i18n';

/** Keys that cannot be bound (they move focus or belong to the browser). */
const UNBINDABLE = new Set(['tab', 'f5', 'f11', 'f12', 'meta', 'os', 'contextmenu']);

export interface OptionsModel {
  /** The settings as they are now. */
  readonly settings: () => Settings;
  /** The rebindable actions, in display order. */
  readonly actions: () => readonly ActionId[];
  /** The default settings (Reset to defaults). */
  readonly defaults: () => Settings;
}

/**
 * The options card: screen shake and flash strength, HUD size, sound and music volume, and key bindings. Every change is
 * handed to `onChange` at once (the app saves and applies it); shake and flash changes also ask
 * for a preview. While a key button is listening, the next key press binds it.
 */
export class OptionsView {
  private listening: { action: ActionId; index: number } | null = null;
  private readonly el = {
    shake: byId<HTMLInputElement>('optShake'),
    shakeOut: byId('optShakeOut'),
    flash: byId<HTMLInputElement>('optFlash'),
    flashOut: byId('optFlashOut'),
    sfx: byId<HTMLInputElement>('optSfx'),
    sfxOut: byId('optSfxOut'),
    music: byId<HTMLInputElement>('optMusic'),
    musicOut: byId('optMusicOut'),
    hud: byId('optHud'),
    keys: byId('optKeys'),
    done: byId<HTMLButtonElement>('btnOptionsDone'),
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly model: OptionsModel,
    private readonly handlers: { onChange: (settings: Settings, preview: boolean) => void; onClose: () => void },
  ) {
    this.el.shake.addEventListener('input', () => this.change({ shake: Number(this.el.shake.value) / 100 }, true));
    this.el.flash.addEventListener('input', () => this.change({ flash: Number(this.el.flash.value) / 100 }, true));
    this.el.sfx.addEventListener('input', () => this.change({ sfx: Number(this.el.sfx.value) / 100 }, false));
    this.el.music.addEventListener('input', () => this.change({ music: Number(this.el.music.value) / 100 }, false));
    this.el.hud.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-scale]');
      if (b) this.change({ hudScale: Number(b.dataset.scale) }, false);
    });
    this.el.keys.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-action]');
      if (!b) return;
      this.listening = { action: b.dataset.action!, index: Number(b.dataset.index) };
      this.render();
    });
    this.el.done.addEventListener('click', () => this.close());
    byId('btnOptionsReset').addEventListener('click', () => {
      this.listening = null;
      // The language is picked in the hangar, so a reset keeps it.
      this.handlers.onChange({ ...this.model.defaults(), locale: this.model.settings().locale }, true);
      this.render();
    });
    // Capture phase, so a key being bound never reaches the game.
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.listening = null;
    this.root.hidden = false;
    this.render();
    this.el.done.focus({ preventScroll: true });
  }

  hide(): void {
    this.listening = null;
    this.root.hidden = true;
  }

  private close(): void {
    this.hide();
    this.handlers.onClose();
  }

  private change(patch: Partial<Settings>, preview: boolean): void {
    this.handlers.onChange({ ...this.model.settings(), ...patch }, preview);
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.open) return;
    const k = e.key.toLowerCase();
    if (this.listening) {
      e.preventDefault();
      e.stopPropagation();
      const { action, index } = this.listening;
      const unbind = k === 'delete' || k === 'backspace';
      if (k !== 'escape' && !unbind && UNBINDABLE.has(k)) return; // keep listening
      this.listening = null;
      if (k === 'escape') this.render();
      else this.change({ keys: rebind(this.model.settings().keys, action, index, unbind ? null : k) }, false);
      return;
    }
    if (k === 'escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  render(): void {
    const s = this.model.settings();
    this.el.shake.value = String(Math.round(s.shake * 100));
    this.el.shakeOut.textContent = `${Math.round(s.shake * 100)}%`;
    this.el.flash.value = String(Math.round(s.flash * 100));
    this.el.flashOut.textContent = `${Math.round(s.flash * 100)}%`;
    this.el.sfx.value = String(Math.round(s.sfx * 100));
    this.el.sfxOut.textContent = `${Math.round(s.sfx * 100)}%`;
    this.el.music.value = String(Math.round(s.music * 100));
    this.el.musicOut.textContent = `${Math.round(s.music * 100)}%`;
    this.el.hud.innerHTML = HUD_SIZES.map(
      ({ scale, label }) => `<button type="button" role="radio" data-scale="${scale}" aria-checked="${s.hudScale === scale}">${t(label)}</button>`,
    ).join('');
    this.el.keys.innerHTML = this.model
      .actions()
      .map((id) => {
        const keys = s.keys[id] ?? [];
        const cells = Array.from({ length: KEYS_PER_ACTION }, (_, i) => {
          const on = this.listening?.action === id && this.listening.index === i;
          const text = on ? t('options.keys.listening') : keys[i] !== undefined ? esc(keyLabel(keys[i]!)) : i === 0 ? t('options.keys.unbound') : '+';
          const cls = `keycap${on ? ' listening' : ''}${keys[i] === undefined ? ' empty' : ''}`;
          return `<button type="button" class="${cls}" data-action="${id}" data-index="${Math.min(i, keys.length)}">${text}</button>`;
        }).join('');
        return `<div class="keyrow"><span>${actionLabel(id)}</span>${cells}</div>`;
      })
      .join('');
  }
}
