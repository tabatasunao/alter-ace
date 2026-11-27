import { localeDef, t } from './index';

/**
 * Fills the page's fixed text from the current language: `data-i18n` sets an element's text,
 * `data-i18n-html` its markup (for strings with key caps), and `data-i18n-aria` / `data-i18n-title`
 * set those attributes. Also sets `<html lang>` so the CSS picks the right CJK font.
 */
export function applyStaticText(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!));
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!);
  document.documentElement.lang = localeDef().tag;
}
