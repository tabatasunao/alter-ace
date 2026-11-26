import type { BannerTone } from '../sim/events';

/** The short message strip under the top HUD. */
export class BannerView {
  private timer = 0;
  /** When the major banner on show expires (performance.now() ms); minor banners wait until then. */
  private majorUntil = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly durationSeconds: () => number,
  ) {}

  /** Shows a banner. A `minor` one (praise) is dropped while a major one is still on show. */
  show(text: string, tone: BannerTone = '', minor = false): void {
    const now = performance.now();
    if (minor && now < this.majorUntil) return;
    if (!minor) this.majorUntil = now + this.durationSeconds() * 1000;
    this.el.textContent = text;
    this.el.className = `show ${tone}`;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.el.className = tone;
    }, this.durationSeconds() * 1000);
  }
}
