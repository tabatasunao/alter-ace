import { clamp } from '../core/math';
import type {
  AimModeDef,
  ArmiesData,
  ArmorDef,
  BattleData,
  DamageTypeDef,
  FrameBuild,
  FrameBuildData,
  FrameDef,
  GameData,
  LoadoutData,
  UnitClassDef,
  UnitWeaponDef,
  WeaponDef,
} from './types';
import type { FrameStat } from './types';

/**
 * Read-only lookup over the loaded game data. Everything that needs a definition
 * by id goes through here, so unknown ids fail loudly in one place.
 */
export class Catalog {
  readonly frameBuild: FrameBuildData;
  readonly damageTypes: readonly DamageTypeDef[];
  readonly armors: readonly ArmorDef[];
  /** In the hangar's arsenal order. */
  readonly weapons: readonly WeaponDef[];
  readonly aimModes: readonly AimModeDef[];
  readonly classes: readonly UnitClassDef[];
  readonly unitWeapons: readonly UnitWeaponDef[];
  readonly battle: BattleData;
  readonly armies: ArmiesData;
  readonly loadout: LoadoutData;
  readonly reticleInterval: number;

  private readonly weaponById: Map<string, WeaponDef>;
  private readonly classById: Map<string, UnitClassDef>;
  private readonly damageTypeById: Map<string, DamageTypeDef>;
  private readonly armorById: Map<string, ArmorDef>;
  private readonly unitWeaponById: Map<string, UnitWeaponDef>;

  constructor(readonly data: GameData) {
    this.frameBuild = data.frames;
    this.damageTypes = data.damage.types;
    this.armors = data.damage.armor;
    this.weapons = data.weapons.weapons;
    this.aimModes = data.aimModes.modes;
    this.classes = data.units.classes;
    this.unitWeapons = data.unitWeapons.weapons;
    this.battle = data.battle;
    this.armies = data.armies;
    this.loadout = data.loadout;
    this.reticleInterval = data.aimModes.reticleInterval;

    this.weaponById = new Map(this.weapons.map((w) => [w.id, w]));
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

  /** A stat's value for this many points (linear from its `min` to its `max`). */
  frameStat(stat: FrameStat, points: number): number {
    const b = this.frameBuild;
    const d = b.stats[stat];
    return d.min + ((d.max - d.min) * clamp(points, 0, b.maxPerStat)) / b.maxPerStat;
  }

  /** The frame a build makes, under the player's name for it. */
  frameFor(build: FrameBuild, name: string): FrameDef {
    return {
      name,
      speed: this.frameStat('speed', build.speed),
      hp: Math.round(this.frameStat('hp', build.hp)),
      reloadMul: this.frameStat('reload', build.reload),
      rateMul: this.frameStat('fireRate', build.fireRate),
      dashCd: this.frameStat('dash', build.dash),
    };
  }

  weapon(id: string): WeaponDef {
    return required(this.weaponById.get(id), 'weapon', id);
  }

  hasWeapon(id: string): boolean {
    return this.weaponById.has(id);
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
