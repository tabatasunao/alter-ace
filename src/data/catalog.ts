import type {
  AimModeDef,
  ArmamentDef,
  ArmiesData,
  ArmorDef,
  BattleData,
  DamageTypeDef,
  FrameDef,
  GameData,
  LoadoutData,
  ToolDef,
  UnitClassDef,
  UnitWeaponDef,
  WeaponDef,
} from './types';

/**
 * Read-only lookup over the loaded game data. Everything that needs a definition
 * by id goes through here, so unknown ids fail loudly in one place.
 */
export class Catalog {
  readonly frames: readonly FrameDef[];
  readonly damageTypes: readonly DamageTypeDef[];
  readonly armors: readonly ArmorDef[];
  readonly weapons: readonly WeaponDef[];
  readonly tools: readonly ToolDef[];
  /** Weapons first, then tools: the hangar's arsenal order. */
  readonly armaments: readonly ArmamentDef[];
  readonly aimModes: readonly AimModeDef[];
  readonly classes: readonly UnitClassDef[];
  readonly unitWeapons: readonly UnitWeaponDef[];
  readonly battle: BattleData;
  readonly armies: ArmiesData;
  readonly loadout: LoadoutData;
  readonly reticleInterval: number;

  private readonly frameById: Map<string, FrameDef>;
  private readonly armamentById: Map<string, ArmamentDef>;
  private readonly classById: Map<string, UnitClassDef>;
  private readonly damageTypeById: Map<string, DamageTypeDef>;
  private readonly armorById: Map<string, ArmorDef>;
  private readonly unitWeaponById: Map<string, UnitWeaponDef>;

  constructor(readonly data: GameData) {
    this.frames = data.frames.frames;
    this.damageTypes = data.damage.types;
    this.armors = data.damage.armor;
    this.weapons = data.weapons.weapons;
    this.tools = data.tools.tools;
    this.armaments = [...this.weapons, ...this.tools];
    this.aimModes = data.aimModes.modes;
    this.classes = data.units.classes;
    this.unitWeapons = data.unitWeapons.weapons;
    this.battle = data.battle;
    this.armies = data.armies;
    this.loadout = data.loadout;
    this.reticleInterval = data.aimModes.reticleInterval;

    this.frameById = new Map(this.frames.map((f) => [f.id, f]));
    this.armamentById = new Map(this.armaments.map((a) => [a.id, a]));
    this.classById = new Map(this.classes.map((c) => [c.id, c]));
    this.damageTypeById = new Map(this.damageTypes.map((t) => [t.id, t]));
    this.armorById = new Map(this.armors.map((a) => [a.id, a]));
    this.unitWeaponById = new Map(this.unitWeapons.map((w) => [w.id, w]));
  }

  damageType(id: string): DamageTypeDef {
    return required(this.damageTypeById.get(id), 'damage type', id);
  }

  armor(id: string): ArmorDef {
    return required(this.armorById.get(id), 'armor', id);
  }

  /** How much a hit of this damage type is scaled by this armor (1 when either is unknown). */
  armorMultiplier(damageTypeId: string, armorId: string): number {
    return this.armorById.get(armorId)?.vs[damageTypeId] ?? 1;
  }

  frame(id: string): FrameDef {
    return required(this.frameById.get(id), 'frame', id);
  }

  armament(id: string): ArmamentDef {
    return required(this.armamentById.get(id), 'weapon or tool', id);
  }

  hasArmament(id: string): boolean {
    return this.armamentById.has(id);
  }

  unitClass(id: string): UnitClassDef {
    return required(this.classById.get(id), 'unit class', id);
  }

  unitWeapon(id: string): UnitWeaponDef {
    return required(this.unitWeaponById.get(id), 'unit weapon', id);
  }

  aimModeIndex(id: string): number {
    const i = this.aimModes.findIndex((m) => m.id === id);
    if (i < 0) throw new Error(`Unknown aim mode "${id}"`);
    return i;
  }
}

function required<T>(value: T | undefined, what: string, id: string): T {
  if (value === undefined) throw new Error(`Unknown ${what} "${id}"`);
  return value;
}
