import { randomSeed, SeededRandom } from '../core/random';
import { VariableStep } from '../core/timestep';
import type { Catalog } from '../data/catalog';
import { LoadoutEditor, sanitizeLoadout } from '../game/loadout';
import type { LoadoutStore } from '../game/loadoutStore';
import { keyBindings, type CommandSink, type InputMode } from '../input/commands';
import { bindWheelZoom, combineMoveInputs } from '../input/combine';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchJoystick } from '../input/TouchJoystick';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { EffectLayer } from '../render/layers/EffectLayer';
import { GridLayer } from '../render/layers/GridLayer';
import { GroundLayer } from '../render/layers/GroundLayer';
import { JoystickLayer } from '../render/layers/JoystickLayer';
import { PlayerLayer } from '../render/layers/PlayerLayer';
import { ShotLayer } from '../render/layers/ShotLayer';
import { SightLineLayer } from '../render/layers/SightLineLayer';
import { UnitLayer } from '../render/layers/UnitLayer';
import { Minimap } from '../render/Minimap';
import { readPalette } from '../render/palette';
import type { MoveInput } from '../sim/input';
import { battlePipeline, demoPipeline } from '../sim/pipelines';
import { PlayerCommands } from '../sim/PlayerCommands';
import { createBattleWorld, createDemoWorld } from '../sim/scenarios';
import type { Simulation } from '../sim/System';
import type { World } from '../sim/World';
import { BannerView } from '../ui/BannerView';
import { byId } from '../ui/dom';
import { HangarView } from '../ui/HangarView';
import { HudView } from '../ui/HudView';
import { PauseView } from '../ui/PauseView';
import { ResultView } from '../ui/ResultView';
import { GameLoop } from './GameLoop';

export interface AppOptions {
  catalog: Catalog;
  store: LoadoutStore;
  /** Fixed battle seed (from ?seed=) for reproducible sorties; random when undefined. */
  seed?: number;
}

/**
 * Composition root and screen flow (hangar → battle → result). Owns the current world and
 * wires sim events to the views. Implements CommandSink so input devices can drive the ace.
 */
export class App implements CommandSink {
  private catalog: Catalog;
  private editor: LoadoutEditor;
  private world: World | null = null;
  private sim: Simulation | null = null;
  private commands: PlayerCommands | null = null;
  private resultTimer = 0;

  private readonly store: LoadoutStore;
  private readonly seed: number | undefined;
  private readonly renderer: CanvasRenderer;
  private readonly minimap: Minimap;
  private readonly keyboard: KeyboardInput;
  private readonly joystick: TouchJoystick;
  private readonly moveInput: MoveInput;
  private readonly hangar: HangarView;
  private readonly hud: HudView;
  private readonly result: ResultView;
  private readonly pause: PauseView;
  private readonly banner: BannerView;
  private readonly loop: GameLoop;

  constructor(options: AppOptions) {
    this.catalog = options.catalog;
    this.store = options.store;
    this.seed = options.seed;
    this.editor = new LoadoutEditor(this.catalog, sanitizeLoadout(this.store.load(), this.catalog));

    const palette = readPalette();
    const canvas = byId<HTMLCanvasElement>('world');
    const markTouch = () => document.body.classList.add('touch');

    this.joystick = new TouchJoystick(canvas, () => this.commands?.canAct ?? false, markTouch);
    this.keyboard = new KeyboardInput(this, () =>
      keyBindings(this.catalog.loadout.slots, this.catalog.aimModes.map((m) => m.key)),
    );
    this.moveInput = combineMoveInputs([this.keyboard, this.joystick]);
    bindWheelZoom(canvas, this);

    this.renderer = new CanvasRenderer(
      canvas,
      palette,
      [new GridLayer(), new GroundLayer(), new UnitLayer(), new SightLineLayer(), new ShotLayer(), new EffectLayer(), new PlayerLayer()],
      [new JoystickLayer(this.joystick)],
    );
    this.minimap = new Minimap(byId('minimap'), palette, () => this.renderer.pixelRatio, () => this.renderer.viewport);

    this.hangar = new HangarView(
      byId('hangar'),
      { catalog: this.catalog, editor: this.editor },
      () => this.store.save(this.editor.value),
      () => this.launch(),
    );
    this.hud = new HudView(byId('hud'), this);
    this.result = new ResultView(byId('result'), { onAgain: () => this.launch(), onHangar: () => this.toHangar() });
    this.pause = new PauseView(byId('pause'), { onResume: () => this.togglePause(false), onAbandon: () => this.toHangar() });
    this.banner = new BannerView(byId('banner'), () => this.catalog.battle.timing.bannerDuration);

    document.addEventListener('visibilitychange', () => {
      const mode = this.inputMode();
      if (document.hidden && (mode === 'playing' || mode === 'paused')) this.togglePause(true);
    });
    window.addEventListener('touchstart', markTouch, { once: true, passive: true });

    this.loop = new GameLoop(
      new VariableStep(this.catalog.battle.timing.maxFrameDt),
      (dt) => this.update(dt),
      () => this.render(),
    );
  }

  start(): void {
    this.hangar.render();
    this.startDemo();
    this.loop.start();
  }

  /** Swaps in re-loaded tuning data. Applies now in the hangar, otherwise from the next sortie. */
  setCatalog(catalog: Catalog): void {
    this.catalog = catalog;
    this.editor = new LoadoutEditor(catalog, this.editor.value);
    this.hangar.setModel({ catalog, editor: this.editor });
    if (!this.world || this.world.isDemo) {
      this.hangar.render();
      this.startDemo();
    }
  }

  /** The live world, for debugging from the console (exposed as `alter` in dev builds). */
  debugWorld(): World | null {
    return this.world;
  }

  // ---------- CommandSink ----------

  inputMode(): InputMode {
    const w = this.world;
    if (!w || w.isDemo) return 'menu';
    if (w.status.over) return 'ended';
    return w.status.paused ? 'paused' : 'playing';
  }

  selectSlot(index: number): void {
    this.commands?.selectSlot(index);
  }

  setAimIndex(index: number): void {
    this.commands?.setAim(index);
  }

  cycleAim(delta: number): void {
    this.commands?.cycleAim(delta);
  }

  dash(): void {
    this.commands?.dash();
  }

  superRelease(): void {
    this.commands?.superRelease();
  }

  reload(): void {
    this.commands?.reload();
  }

  zoomBy(factor: number): void {
    this.commands?.zoomBy(factor);
  }

  togglePause(force?: boolean): void {
    const w = this.world;
    if (!w || w.isDemo || w.status.over) return;
    w.status.paused = force ?? !w.status.paused;
    this.pause.setVisible(w.status.paused);
    this.resetInput();
  }

  // ---------- Screen flow ----------

  private launch(): void {
    if (!this.editor.check().ok) return;
    this.store.save(this.editor.value);
    clearTimeout(this.resultTimer);
    this.hangar.hide();
    this.result.hide();
    this.pause.setVisible(false);
    const world = this.startBattle();
    this.hud.build(world);
    this.hud.show();
    this.hud.update(world);
    this.banner.show('Sortie start. Break the enemy army.', 'good');
  }

  private toHangar(): void {
    clearTimeout(this.resultTimer);
    this.result.hide();
    this.pause.setVisible(false);
    this.hud.hide();
    this.hangar.show();
    this.hangar.render();
    this.startDemo();
  }

  private showResult(world: World): void {
    this.hud.hide();
    this.result.show(world);
  }

  private startBattle(): World {
    const seed = this.seed ?? randomSeed();
    const world = createBattleWorld(this.catalog, new SeededRandom(seed), this.editor.value, this.renderer.viewport);
    world.events.on('banner', ({ text, tone }) => this.banner.show(text, tone));
    world.events.on('slotDenied', ({ slot }) => this.hud.deny(slot));
    world.events.on('battleEnded', () => {
      this.resetInput();
      this.resultTimer = window.setTimeout(() => {
        if (this.world === world) this.showResult(world);
      }, this.catalog.battle.timing.resultDelay * 1000);
    });
    this.world = world;
    this.sim = battlePipeline(this.moveInput);
    this.commands = new PlayerCommands(world);
    console.info(`[battle] seed ${seed} (add ?seed=${seed} to the URL to replay this deployment)`);
    return world;
  }

  private startDemo(): void {
    const world = createDemoWorld(this.catalog, new SeededRandom(randomSeed()), this.renderer.viewport);
    world.events.on('demoExhausted', () => this.startDemo());
    this.world = world;
    this.sim = demoPipeline();
    this.commands = null;
  }

  private resetInput(): void {
    this.keyboard.reset();
    this.joystick.reset();
  }

  // ---------- Frame ----------

  private update(dt: number): void {
    if (this.world && this.sim && !this.world.status.paused) this.sim.step(this.world, dt);
  }

  private render(): void {
    const world = this.world;
    this.renderer.render(world);
    if (world && !world.isDemo) {
      this.minimap.draw(world);
      if (this.hud.visible) this.hud.update(world);
    }
  }
}
