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

const lastHtml = new WeakMap<Element, string>();

/** Sets innerHTML only when it changed. Callers pass markup they built from numbers and fixed text. */
export function setHtml(el: Element, html: string): void {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

/** A counter readout with its leading zeros dimmed, e.g. 7 in 3 digits: <span class="lz">00</span>7. */
export function readoutHtml(value: number, digits: number): string {
  const s = String(Math.max(0, Math.round(value)));
  const pad = Math.max(0, digits - s.length);
  return pad ? `<span class="lz">${'0'.repeat(pad)}</span>${s}` : s;
}

/** Text made safe to put in markup. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Key caps for a list of key labels. */
export function kbdHtml(labels: readonly string[]): string {
  return labels.map((l) => `<kbd>${escapeHtml(l)}</kbd>`).join('');
}
