import type { Message } from '../sim/messages';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';

/** The languages the game ships in. Chinese is Simplified. */
export type Locale = 'en' | 'ja' | 'zh' | 'ko';

export interface LocaleDef {
  readonly id: Locale;
  /** The language's own name, for the language picker. */
  readonly name: string;
  /** BCP 47 tag for `<html lang>` and number formatting. */
  readonly tag: string;
}

export const LOCALES: readonly LocaleDef[] = [
  { id: 'en', name: 'English', tag: 'en' },
  { id: 'ja', name: '日本語', tag: 'ja' },
  { id: 'zh', name: '简体中文', tag: 'zh-Hans' },
  { id: 'ko', name: '한국어', tag: 'ko' },
];

export type Table = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number | Message>>;

/** Every language's strings: UI text (en.json is the source), plus the data files' names and descriptions in the other languages. */
export const TABLES: Readonly<Record<Locale, Table>> = { en, ja, zh, ko };

/** Keys shown in English in every language (the launch sequence). The other tables leave them out. */
export const ENGLISH_ONLY = /^launch\./;

let current: Locale = 'en';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function localeDef(locale: Locale = current): LocaleDef {
  return LOCALES.find((l) => l.id === locale)!;
}

/** The first supported language in the browser's preference list, or English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split('-')[0];
    const hit = LOCALES.find((l) => l.id === base);
    if (hit) return hit.id;
  }
  return 'en';
}

/** UI text for `key` in the current language (English when missing, or for `ENGLISH_ONLY` keys), with `{name}` placeholders filled from `params`. */
export function t(key: string, params?: Params): string {
  const local = ENGLISH_ONLY.test(key) ? undefined : TABLES[current][key];
  return fill(local ?? en[key as keyof typeof en] ?? key, params);
}

/** A message from the sim: its key in the current language, else its data fallback, else English. */
export function tm(m: Message): string {
  const raw = TABLES[current][m.key] ?? m.fallback ?? en[m.key as keyof typeof en] ?? m.key;
  return fill(raw, m.params);
}

/** Text defined in the data files: the current language's translation of `key`, or the data's own (English) text. */
export function td(key: string, fallback: string): string {
  return (current === 'en' ? undefined : TABLES[current][key]) ?? fallback;
}

/** A whole number with the current language's grouping. */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString(localeDef().tag);
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    if (v === undefined) return whole;
    return typeof v === 'object' ? tm(v) : String(v);
  });
}
