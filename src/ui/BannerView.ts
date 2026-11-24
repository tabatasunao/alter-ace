import type { BannerTone } from '../sim/events';

/** The short message strip under the top HUD. */
export class BannerView {
  private timer = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly durationSeconds: () => number,
  ) {}

  show(text: string, tone: BannerTone = ''): void {
    this.el.textContent = text;
    this.el.className = `show ${tone}`;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.el.className = tone;
    }, this.durationSeconds() * 1000);
  }
}
