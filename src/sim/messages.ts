/**
 * Text the simulation hands to the UI (banners, callouts). The sim stays language-free: it names a
 * translation key and its parameters; the UI translates (src/i18n). A parameter can itself be a
 * message (a unit class's name, say). `fallback` is the English for text defined in the data files.
 */
export interface Message {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number | Message>>;
  readonly fallback?: string;
}

export function msg(key: string, params?: Message['params']): Message {
  return params ? { key, params } : { key };
}
