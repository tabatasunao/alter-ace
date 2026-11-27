import { LOCALES, type Locale } from '../i18n';

/**
 * The language picker at the top right of the hangar: every language by its own name, so anyone
 * can find theirs whatever language is showing. A click hands the language to `onPick`.
 */
export class LanguagePicker {
  constructor(
    private readonly root: HTMLElement,
    onPick: (locale: Locale) => void,
  ) {
    root.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-locale]');
      if (b) onPick(b.dataset.locale as Locale);
    });
  }

  render(current: Locale): void {
    this.root.innerHTML = LOCALES.map(
      (l) => `<button type="button" role="radio" lang="${l.tag}" data-locale="${l.id}" aria-checked="${current === l.id}">${l.name}</button>`,
    ).join('');
  }
}
