import { randomSeed, SeededRandom } from '../core/random';
import { VariableStep } from '../core/timestep';
import type { Catalog } from '../data/catalog';
import { recordSortie, sanitizeCareer, type Career, type CareerStore, type SortieRecord } from '../game/career';
import { LoadoutEditor, sanitizeLoadout } from '../game/loadout';
import type { LoadoutStore } from '../game/loadoutStore';
import { rateSortie } from '../game/rating';
import { actionList, defaultSettings, sanitizeSettings, type Settings, type SettingsStore } from '../game/settings';
import type { CommandSink, InputMode } from '../input/commands';
import { KeyMap } from '../input/keymap';
import { bindWheelZoom, combineMoveInputs } from '../input/combine';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchJoystick } from '../input/TouchJoystick';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { EffectLayer } from '../render/layers/EffectLayer';
import { GridLayer } from '../render/layers/GridLayer';
import { GroundLayer } from '../render/layers/GroundLayer';
import { ImpactFlashLayer } from '../render/layers/ImpactFlashLayer';
import { JoystickLayer } from '../render/layers/JoystickLayer';
import { PlayerLayer } from '../render/layers/PlayerLayer';
import { ShotLayer } from '../render/layers/ShotLayer';
import { SightLineLayer } from '../render/layers/SightLineLayer';
import { ThreatLayer } from '../render/layers/ThreatLayer';
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
import { LaunchView } from '../ui/LaunchView';
import { CANVAS_TEXT_KEYS } from '../render/painters/effectPainters';
import { byId } from '../ui/dom';
import { HangarView } from '../ui/HangarView';
import { HudView } from '../ui/HudView';
import { OptionsView } from '../ui/OptionsView';
import { LanguagePicker } from '../ui/LanguagePicker';
import { PauseView } from '../ui/PauseView';
import { ResultView } from '../ui/ResultView';
import { detectLocale, getLocale, setLocale, t, tm, type Locale } from '../i18n';
import { dataText } from '../i18n/data';
import { applyStaticText } from '../i18n/static';
import { holdForLaunch, launchAce } from '../sim/launch';
import { GameLoop } from './GameLoop';

/** After the result card appears, confirm is ignored this long, so mashing through a defeat doesn't relaunch at once. */
const RESULT_GUARD_MS = 450;

export interface AppOptions {
  catalog: Catalog;
  store: LoadoutStore;
  /** Best scores and weapon kills across sorties. */
  career: CareerStore;
  /** Screen feel, HUD size and key bindings. */
  settings: SettingsStore;
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
  private career: Career;
  private settings: Settings;
  private keymap: KeyMap;
  /** Whether the result card is up, and until when it ignores confirm (so mashing doesn't retry by accident). */
  private resultShown = false;
  private resultGuardUntil = 0;
  /** Where the options card was opened from. */
  private optionsFrom: 'hangar' | 'pause' | null = null;
  /** The finished sortie's career record, for the result card. */
  private lastRecord: SortieRecord | null = null;

  private readonly store: LoadoutStore;
  private readonly careerStore: CareerStore;
  private readonly settingsStore: SettingsStore;
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
  private readonly options: OptionsView;
  private readonly languagePicker: LanguagePicker;
  private readonly launchView: LaunchView;
  /** The key bindings the key map and key lists were last built from (JSON). */
  private appliedKeys = '';
  private readonly loop: GameLoop;

  constructor(options: AppOptions) {
    this.catalog = options.catalog;
    this.store = options.store;
    this.careerStore = options.career;
    this.career = sanitizeCareer(this.careerStore.load());
    this.settingsStore = options.settings;
    this.settings = sanitizeSettings(this.settingsStore.load(), this.catalog.loadout.slots);
    this.keymap = this.buildKeyMap();
    setLocale(this.wantedLocale()); // so the views below are built in the right language
    this.seed = options.seed;
    this.editor = new LoadoutEditor(this.catalog, sanitizeLoadout(this.store.load(), this.catalog));

    const palette = readPalette();
    const canvas = byId<HTMLCanvasElement>('world');
    const markTouch = () => document.body.classList.add('touch');

    this.joystick = new TouchJoystick(canvas, () => this.commands?.canAct ?? false, markTouch);
    this.keyboard = new KeyboardInput(this, () => this.keymap);
    this.moveInput = combineMoveInputs([this.keyboard, this.joystick]);
    bindWheelZoom(canvas, this);

    this.renderer = new CanvasRenderer(
      canvas,
      palette,
      [new GridLayer(), new GroundLayer(), new UnitLayer(), new SightLineLayer(), new ShotLayer(), new EffectLayer(), new PlayerLayer()],
      [new ImpactFlashLayer(), new ThreatLayer(), new JoystickLayer(this.joystick)],
    );
    this.minimap = new Minimap(byId('minimap'), palette, () => this.renderer.pixelRatio, () => this.renderer.viewport);

    this.hangar = new HangarView(
      byId('hangar'),
      { catalog: this.catalog, editor: this.editor, career: () => this.career, keys: () => this.keymap },
      () => this.store.save(this.editor.value),
      () => this.launch(),
      () => this.openOptions('hangar'),
    );
    this.hud = new HudView(byId('hud'), this, () => this.keymap);
    this.result = new ResultView(byId('result'), { onAgain: () => this.launch(), onHangar: () => this.toHangar() }, () => this.keymap);
    this.pause = new PauseView(byId('pause'), {
      onResume: () => this.togglePause(false),
      onRestart: () => this.launch(),
      onOptions: () => this.openOptions('pause'),
      onAbandon: () => this.toHangar(),
    });
    this.banner = new BannerView(byId('banner'), () => this.catalog.battle.timing.bannerDuration);
    this.options = new OptionsView(
      byId('options'),
      {
        settings: () => this.settings,
        actions: () => actionList(this.catalog.loadout.slots),
        defaults: () => defaultSettings(this.catalog.loadout.slots),
      },
      { onChange: (s, preview) => this.changeSettings(s, preview), onClose: () => this.closeOptions() },
    );
    this.launchView = new LaunchView(byId('launch'));
    this.languagePicker = new LanguagePicker(byId('langPick'), (locale) => this.changeSettings({ ...this.settings, locale }, false));
    this.applyLocale();
    this.applySettings();

    // Leaving the tab or the window pauses the sortie.
    document.addEventListener('visibilitychange', () => {
      const mode = this.inputMode();
      if (document.hidden && (mode === 'playing' || mode === 'paused')) this.togglePause(true);
    });
    window.addEventListener('blur', () => {
      if (this.inputMode() === 'playing') this.togglePause(true);
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
    this.settings = sanitizeSettings(this.settings, catalog.loadout.slots);
    this.applySettings();
    this.editor = new LoadoutEditor(catalog, this.editor.value);
    this.hangar.setModel({ catalog, editor: this.editor, career: () => this.career, keys: () => this.keymap });
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
    if (this.options.open) return 'options';
    if (this.launchView.running) return 'launch';
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

  confirm(): void {
    if (this.launchView.running) return this.launchView.skip();
    const w = this.world;
    if (!w || w.isDemo) {
      this.launch();
    } else if (w.status.over && !this.resultShown) {
      clearTimeout(this.resultTimer);
      this.showResult(w);
    } else if (w.status.over && performance.now() >= this.resultGuardUntil) {
      this.launch();
    }
  }

  back(): void {
    const w = this.world;
    if (!w || !w.status.over) return;
    if (this.resultShown) {
      this.toHangar();
    } else {
      clearTimeout(this.resultTimer);
      this.showResult(w);
    }
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
    if (!this.editor.check().ok) {
      this.hangar.denyLaunch();
      return;
    }
    this.resultShown = false;
    this.store.save(this.editor.value);
    clearTimeout(this.resultTimer);
    this.hangar.hide();
    this.result.hide();
    this.pause.setVisible(false);
    const world = this.startBattle();
    this.hud.build(world);
    this.hud.hide();
    this.playLaunch(world);
  }

  /**
   * The launch sequence: the battle holds with the camera close on the ace while the ALTER's name
   * and specs show; at LAUNCH the ace boosts off and the camera eases back; then the HUD comes up.
   */
  private playLaunch(world: World): void {
    const P = world.player!;
    holdForLaunch(world);
    this.launchView.play(
      { frame: P.frame, gear: P.slots.map((s) => dataText.weaponName(s.def)) },
      () => launchAce(world),
      () => {
        if (this.world !== world) return;
        this.hud.show();
        this.hud.update(world);
        this.banner.show(t('banner.sortieStart'), 'good');
      },
    );
  }

  private toHangar(): void {
    clearTimeout(this.resultTimer);
    this.resultShown = false;
    this.result.hide();
    this.pause.setVisible(false);
    this.hud.hide();
    this.hangar.show();
    this.hangar.render();
    this.startDemo();
  }

  private showResult(world: World): void {
    if (this.resultShown || !this.lastRecord) return;
    this.resultShown = true;
    this.resultGuardUntil = performance.now() + RESULT_GUARD_MS;
    this.hud.hide();
    this.result.show(world, this.lastRecord);
  }

  // ---------- Options ----------

  private openOptions(from: 'hangar' | 'pause'): void {
    this.optionsFrom = from;
    if (from === 'pause') this.pause.setVisible(false);
    this.resetInput();
    this.options.show();
  }

  private closeOptions(): void {
    const from = this.optionsFrom;
    this.optionsFrom = null;
    if (from === 'pause' && this.world && !this.world.isDemo && !this.world.status.over) this.pause.setVisible(true);
  }

  private changeSettings(settings: Settings, preview: boolean): void {
    this.settings = sanitizeSettings(settings, this.catalog.loadout.slots);
    this.settingsStore.save(this.settings);
    this.applySettings();
    if (preview) this.renderer.previewFeel();
  }

  /** The language the settings ask for, or the browser's. */
  private wantedLocale(): Locale {
    return this.settings.locale ?? detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
  }

  /** Switches the interface language: fixed text, the hangar, key lists, the HUD and the canvas fonts. */
  private applyLocale(): void {
    setLocale(this.wantedLocale());
    applyStaticText();
    const palette = readPalette();
    this.renderer.setPalette(palette);
    this.minimap.setPalette(palette);
    this.languagePicker.render(getLocale());
    this.hangar.render();
    if (this.world && !this.world.isDemo) this.hud.build(this.world);
    // Canvas text doesn't load web fonts by itself: ask for the callout glyphs up front.
    const sample = CANVAS_TEXT_KEYS.map((k) => t(k)).join('');
    document.fonts?.load(`700 16px ${palette.fontDisplay}`, sample).catch(() => {});
  }

  /**
   * Applies the settings: language, screen feel, HUD size and key bindings. The key map and every
   * key list are rebuilt only when the bindings or the language changed (a slider drag changes
   * neither).
   */
  private applySettings(): void {
    const s = this.settings;
    const localeChanged = this.wantedLocale() !== getLocale();
    if (localeChanged) this.applyLocale();
    this.renderer.setFeel({ shake: s.shake, flash: s.flash });
    document.documentElement.style.setProperty('--hud-scale', String(s.hudScale));
    const keys = JSON.stringify(s.keys);
    if (localeChanged || keys !== this.appliedKeys) {
      this.appliedKeys = keys;
      this.keymap = this.buildKeyMap();
      this.hangar.renderKeys();
      this.pause.setKeys(this.keymap, this.catalog.loadout.slots);
    }
  }

  private buildKeyMap(): KeyMap {
    return new KeyMap(this.settings.keys, this.catalog.aimModes.map((m) => m.key));
  }

  /** Adds a finished sortie to the career (weapon kills, best score) and saves it. */
  private recordCareer(world: World): SortieRecord {
    const rating = rateSortie(world);
    const record = recordSortie(
      this.career,
      {
        enemies: world.stats.enemyTotal,
        killsBy: world.stats.killsBy,
        score: rating?.score ?? null,
        progress: 1 - world.enemiesLeft / Math.max(1, world.stats.enemyTotal),
      },
      this.catalog.loadout.medals,
    );
    this.career = record.career;
    this.careerStore.save(record.career);
    return record;
  }

  private startBattle(): World {
    const seed = this.seed ?? randomSeed();
    const world = createBattleWorld(this.catalog, new SeededRandom(seed), this.editor.setup, this.renderer.viewport);
    world.events.on('banner', ({ msg, tone, minor }) => this.banner.show(tm(msg), tone, minor));
    world.events.on('actionDenied', ({ action }) => this.hud.denyAction(action));
    world.events.on('battleEnded', () => {
      this.resetInput();
      this.lastRecord = this.recordCareer(world);
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
