import { randomSeed, SeededRandom } from '../core/random';
import { VariableStep } from '../core/timestep';
import type { Catalog } from '../data/catalog';
import { FIRST_SORTIE, learn, recordSortie, sanitizeCareer, TUTORIAL_DONE, type Career, type CareerStore, type SortieRecord } from '../game/career';
import { LoadoutEditor, sanitizeLoadout } from '../game/loadout';
import type { LoadoutStore } from '../game/loadoutStore';
import { rateSortie } from '../game/rating';
import { actionList, defaultSettings, sanitizeSettings, slotAction, type ActionId, type Settings, type SettingsStore } from '../game/settings';
import { textKeys } from '../data/textKeys';
import type { CommandSink, InputMode } from '../input/commands';
import { keyLabel, KeyMap } from '../input/keymap';
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
import { battlePipeline, demoPipeline, tutorialPipeline } from '../sim/pipelines';
import { PlayerCommands } from '../sim/PlayerCommands';
import { createBattleWorld, createDemoWorld, createFollowUpWorld, createTutorialWorld } from '../sim/scenarios';
import { currentStage, stageCount } from '../sim/tutorial';
import type { Simulation } from '../sim/System';
import type { World } from '../sim/World';
import { BannerView } from '../ui/BannerView';
import { LaunchView } from '../ui/LaunchView';
import { CANVAS_TEXT_KEYS } from '../render/painters/effectPainters';
import { byId } from '../ui/dom';
import { HangarView } from '../ui/HangarView';
import { KeyPromptView, type KeyPrompt, type StageCount } from '../ui/KeyPromptView';
import { MissionFlashView } from '../ui/MissionFlashView';
import { ObjectiveView, type Objective } from '../ui/ObjectiveView';
import { HudView } from '../ui/HudView';
import { OptionsView } from '../ui/OptionsView';
import { LanguagePicker } from '../ui/LanguagePicker';
import { PauseView } from '../ui/PauseView';
import { ResultView } from '../ui/ResultView';
import { detectLocale, getLocale, setLocale, t, tm, type Locale } from '../i18n';
import { dataText } from '../i18n/data';
import { applyStaticText } from '../i18n/static';
import { holdForLaunch, launchAce } from '../sim/launch';
import { AudioEngine } from '../audio/AudioEngine';
import { BattleAudio } from '../audio/BattleAudio';
import { GameLoop } from './GameLoop';

/** What a launch starts: a sortie, the tutorial mission, or the battle that follows the tutorial (no launch sequence). */
type SortieMode = 'battle' | 'tutorial' | 'afterTutorial';

/** How long the first-mission title stays on screen (matches its CSS animation). */
const MISSION_FLASH_SECONDS = 2.6;
/** The tutorial key prompt: a cap stays lit this long after its key is pressed; the last key pressed shows this long; gap under the ace (px). */
const KEY_LIT_MS = 220;
const KEY_PRESSED_MS = 900;
const KEY_PROMPT_GAP = 26;
/** Gap between the top of the ace and the tutorial step's count (px). */
const STAGE_COUNT_GAP = 22;

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
  /** What the last launch started, so Restart repeats it. */
  private lastMode: SortieMode = 'battle';

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
  private readonly objectiveView: ObjectiveView;
  private readonly keyPrompt: KeyPromptView;
  private readonly missionFlash: MissionFlashView;
  private readonly result: ResultView;
  private readonly pause: PauseView;
  private readonly banner: BannerView;
  private readonly options: OptionsView;
  private readonly languagePicker: LanguagePicker;
  private readonly launchView: LaunchView;
  private readonly audio = new AudioEngine(import.meta.env.BASE_URL);
  private readonly battleAudio = new BattleAudio(this.audio);
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
      () => this.startSortie('tutorial'),
    );
    this.hud = new HudView(byId('hud'), this, () => this.keymap);
    this.objectiveView = new ObjectiveView(byId('objective'));
    this.keyPrompt = new KeyPromptView(byId('keyPrompt'), byId('stageCount'));
    this.missionFlash = new MissionFlashView(byId('missionFlash'), MISSION_FLASH_SECONDS);
    this.result = new ResultView(byId('result'), { onAgain: () => this.launch(), onHangar: () => this.toHangar() }, () => this.keymap);
    this.pause = new PauseView(byId('pause'), {
      onResume: () => this.togglePause(false),
      onRestart: () => this.startSortie(this.lastMode),
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

    // Browsers allow audio only after a click or key press. Buttons click (unless data-sound="none").
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    document.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (b && !b.closest('[data-sound="none"]')) this.audio.play('uiClick');
    });

    // Leaving the tab or the window pauses the sortie (and the audio, while the tab is hidden).
    document.addEventListener('visibilitychange', () => {
      const mode = this.inputMode();
      if (document.hidden && (mode === 'playing' || mode === 'paused')) this.togglePause(true);
      if (document.hidden) this.audio.suspend();
      else this.audio.resume();
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
    this.audio.playMusic('hangar');
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
      if (this.hangar.firstVisit) this.startSortie('tutorial');
      else this.launch();
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
    if (this.resultShown || w.mode === 'tutorial') {
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
    this.audio.duckMusic(w.status.paused);
    this.resetInput();
  }

  // ---------- Screen flow ----------

  private launch(): void {
    this.startSortie('battle');
  }

  /**
   * Starts a sortie or the tutorial mission with the current loadout, through the launch sequence.
   * The battle that follows the tutorial starts at once, without it.
   */
  private startSortie(mode: SortieMode): void {
    if (!this.editor.check().ok) {
      this.hangar.denyLaunch();
      this.audio.play('uiDeny');
      return;
    }
    this.audio.play('uiConfirm');
    if (mode !== 'tutorial') this.learnControl(FIRST_SORTIE);
    this.lastMode = mode;
    this.audio.playMusic('battle');
    this.audio.duckMusic(false);
    this.resultShown = false;
    this.store.save(this.editor.value);
    clearTimeout(this.resultTimer);
    this.hangar.hide();
    this.result.hide();
    this.pause.setVisible(false);
    const world = this.startBattle(mode);
    this.objectiveView.render(null);
    this.keyPrompt.render(null);
    this.keyPrompt.renderCount(null);
    this.missionFlash.hide();
    byId('hud').classList.toggle('tutorial', mode === 'tutorial');
    this.hud.build(world);
    if (mode === 'afterTutorial') return this.beginBattle(world);
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
    this.audio.play('launchRumble');
    this.launchView.play(
      { frame: P.frame, gear: P.slots.map((s) => dataText.weaponName(s.def)) },
      () => {
        launchAce(world);
        this.audio.play('launchGo');
      },
      () => {
        if (this.world === world) this.beginBattle(world);
      },
    );
  }

  /** The HUD comes up and, in a sortie, the start banner (after the tutorial: the first-mission title). */
  private beginBattle(world: World): void {
    this.hud.show();
    this.hud.update(world);
    if (this.lastMode === 'afterTutorial') this.missionFlash.show(t('mission.first'));
    else if (world.mode === 'battle') this.banner.show(t('banner.sortieStart'), 'good');
  }

  private toHangar(): void {
    clearTimeout(this.resultTimer);
    this.resultShown = false;
    this.result.hide();
    this.pause.setVisible(false);
    this.hud.hide();
    this.hangar.show();
    this.hangar.render();
    this.audio.duckMusic(false);
    this.audio.playMusic('hangar');
    this.startDemo();
  }

  private showResult(world: World): void {
    if (this.resultShown) return;
    // After the tutorial there is no result card: the follow-up battle starts.
    if (world.mode === 'tutorial') return this.startSortie('afterTutorial');
    if (!this.lastRecord) return;
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
    const sfx = this.settings.sfx;
    this.settings = sanitizeSettings(settings, this.catalog.loadout.slots);
    this.settingsStore.save(this.settings);
    this.applySettings();
    if (preview) this.renderer.previewFeel();
    if (this.settings.sfx !== sfx) this.audio.play('uiSelect'); // a sample at the new volume
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
    this.audio.setVolumes(s.sfx, s.music);
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

  /** The tutorial objective for the HUD, with the current keys (touch screens: the touch wording). */
  private objective(world: World): Objective | null {
    const t = world.tutorial;
    const P = world.player;
    if (!t || !P) return null;
    const stage = currentStage(t);
    const touch = document.body.classList.contains('touch');
    // Once the control is used, a stage with an after-text shows it, without key caps.
    const after = t.used && !!stage.afterText && !!stage.afterTouchText;
    const keys = touch || after ? [] : stage.keys.flatMap((k) => (k === 'slots' ? P.slots.map((_, i) => this.keymap.label(slotAction(i))) : [this.keymap.label(k)]));
    const text = after
      ? touch
        ? { key: textKeys.tutorialAfterTouchText(stage.id), fallback: stage.afterTouchText! }
        : { key: textKeys.tutorialAfterText(stage.id), fallback: stage.afterText! }
      : touch
        ? { key: textKeys.tutorialTouchText(stage.id), fallback: stage.touchText }
        : { key: textKeys.tutorialText(stage.id), fallback: stage.text };
    return { step: Math.min(t.index, t.stages.length - 1) + 1, total: t.stages.length, text, keys, done: t.clearedAt >= 0 };
  }

  /** The tutorial step's count over the ace (also on touch screens, and once the step is cleared). */
  private stageCountFor(world: World): StageCount | null {
    const t = world.tutorial;
    const P = world.player;
    const c = t && P && t.begun ? stageCount(t) : null;
    if (!c || !P) return null;
    const { width, height } = this.renderer.viewport;
    const z = world.camera.zoom;
    return {
      x: width / 2 + (P.x - world.camera.x) * z,
      y: height / 2 + (P.y - world.camera.y) * z - P.size * z * 0.5 - STAGE_COUNT_GAP,
      ...c,
    };
  }

  /**
   * The tutorial's big key caps just under the ace: the keys the stage asks for (lit while held or
   * just pressed) and the key last pressed. None on touch screens, between stages, or once a stage
   * has moved on to its after-text.
   */
  private keyPromptFor(world: World): KeyPrompt | null {
    const t = world.tutorial;
    const P = world.player;
    if (!t || !P || t.clearedAt >= 0 || world.status.over || document.body.classList.contains('touch')) return null;
    const stage = currentStage(t);
    if (t.used && stage.afterText) return null;
    // Validation guarantees every stage key is an action id or 'slots'.
    const actions = stage.keys.flatMap((k): ActionId[] => (k === 'slots' ? P.slots.map((_, i) => slotAction(i)) : [k as ActionId]));
    if (actions.length === 0) return null;
    const now = performance.now();
    const bound = (a: ActionId) => this.keymap.bindings[a] ?? [];
    // A control that is recharging shows grey, filling up as it charges (the dash).
    const charge = (a: ActionId) => (a === 'dash' && P.dashCd > 0 ? 1 - P.dashCd / P.frame.dashCd : null);
    const caps = actions.map((a) => ({
      label: this.keymap.label(a),
      on: bound(a).some((k) => this.keyboard.pressedRecently(k, KEY_LIT_MS, now)),
      charge: charge(a),
    }));
    const last = this.keyboard.lastPress;
    const pressed =
      last && now - last.at < KEY_PRESSED_MS ? { label: keyLabel(last.key), match: actions.some((a) => bound(a).includes(last.key)) } : null;
    const { width, height } = this.renderer.viewport;
    const z = world.camera.zoom;
    return {
      x: width / 2 + (P.x - world.camera.x) * z,
      y: height / 2 + (P.y - world.camera.y) * z + P.size * z * 0.5 + KEY_PROMPT_GAP,
      caps,
      cross: stage.keys.join() === 'up,left,down,right',
      pressed,
    };
  }

  /** Remembers that the player has done something for the first time (a control, the first launch). */
  private learnControl(id: string): void {
    const next = learn(this.career, id);
    if (next === this.career) return;
    this.career = next;
    this.careerStore.save(next);
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

  private startBattle(mode: SortieMode): World {
    const seed = this.seed ?? randomSeed();
    const random = new SeededRandom(seed);
    const setup = this.editor.setup;
    const viewport = this.renderer.viewport;
    const prev = this.world?.player ? this.world : null;
    const world =
      mode === 'tutorial'
        ? createTutorialWorld(this.catalog, random, setup, viewport)
        : mode === 'afterTutorial' && prev
          ? createFollowUpWorld(this.catalog, random, setup, viewport, prev, prev.mode === 'tutorial')
          : createBattleWorld(this.catalog, random, setup, viewport);
    world.events.on('banner', ({ msg, tone, minor }) => {
      this.banner.show(tm(msg), tone, minor);
      if (tone) this.audio.play(tone === 'good' ? 'bannerGood' : 'bannerWarn');
    });
    world.events.on('actionDenied', ({ action }) => {
      this.hud.denyAction(action);
      this.audio.play('uiDeny');
    });
    world.events.on('battleEnded', () => {
      this.resetInput();
      this.audio.playMusic(world.status.win ? 'victory' : null);
      if (!world.status.win) this.audio.play('defeat');
      // The tutorial mission is practice: it counts toward no career record.
      if (world.mode === 'tutorial') this.learnControl(TUTORIAL_DONE);
      else this.lastRecord = this.recordCareer(world);
      const delay = world.mode === 'tutorial' ? this.catalog.armies.tutorial.followUp.delay : this.catalog.battle.timing.resultDelay;
      this.resultTimer = window.setTimeout(() => {
        if (this.world === world) this.showResult(world);
      }, delay * 1000);
    });
    this.world = world;
    this.sim = mode === 'tutorial' ? tutorialPipeline(this.moveInput) : battlePipeline(this.moveInput);
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
      if (this.hud.visible) {
        this.hud.update(world);
        this.objectiveView.render(this.objective(world));
        this.keyPrompt.render(this.keyPromptFor(world));
        this.keyPrompt.renderCount(this.stageCountFor(world));
      }
      const halfWidth = this.renderer.viewport.width / 2 / world.camera.zoom;
      this.battleAudio.update(world, { x: world.camera.x, y: world.camera.y, halfWidth });
    }
  }
}
