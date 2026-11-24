/** The element with this id; throws if the page markup is missing it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

const lastText = new WeakMap<Element, string>();

/** Sets textContent only when it changed (the HUD updates every frame). */
export function setText(el: Element, value: string | number): void {
  const text = String(value);
  if (lastText.get(el) === text) return;
  lastText.set(el, text);
  el.textContent = text;
}

/** Restarts a CSS animation class on an element. */
export function replayAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}
