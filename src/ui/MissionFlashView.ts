/** A big title that flashes across the middle of the screen and fades (the start of the first mission). */
export class MissionFlashView {
  private timer = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly seconds: number,
  ) {}

  show(text: string): void {
    this.el.textContent = text;
    this.el.hidden = false;
    this.el.classList.remove('show');
    void this.el.offsetWidth; // restart the animation
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), this.seconds * 1000);
  }

  hide(): void {
    clearTimeout(this.timer);
    this.el.classList.remove('show');
    this.el.hidden = true;
  }
}
