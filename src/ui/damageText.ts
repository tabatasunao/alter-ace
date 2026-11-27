import type { Catalog } from '../data/catalog';
import type { UnitClassDef, WeaponDef } from '../data/types';
import { t } from '../i18n';
import { dataText } from '../i18n/data';

/**
 * Text for damage types and armor, shared by the hangar and HUD. Each damage type id gets
 * a CSS class `dt-<id>` (color token `--<id>` in style.css).
 */

/** Items joined with the current language's list separator. */
export function listOf(items: readonly string[]): string {
  return items.join(t('common.listSep'));
}

/** The damage type's name, colored. */
export function damageTypeBadge(catalog: Catalog, typeId: string): string {
  return `<b class="dt dt-${typeId}">${dataText.damageName(catalog.damageType(typeId))}</b>`;
}

/** Armor names this damage type hits harder (strong) or softer (weak). */
function damageTypeMatchups(catalog: Catalog, typeId: string): { strong: string[]; weak: string[] } {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const a of catalog.armors) {
    const m = a.vs[typeId] ?? 1;
    if (m > 1) strong.push(dataText.armorName(a));
    else if (m < 1) weak.push(dataText.armorName(a));
  }
  return { strong, weak };
}

/** "Strong vs Reactive armor · Weak vs Heavy plate" for a weapon card. */
export function matchupLine(catalog: Catalog, typeId: string): string {
  const { strong, weak } = damageTypeMatchups(catalog, typeId);
  const parts = [];
  if (strong.length) parts.push(t('dmg.strong', { list: listOf(strong) }));
  if (weak.length) parts.push(t('dmg.weak', { list: listOf(weak) }));
  return parts.join(' · ');
}

/** "Assault rifle (Kinetic)" for the unit legend: the class's weapon and its damage type, plus its enemy-army weapon if it has one. */
export function unitWeaponLine(catalog: Catalog, cls: UnitClassDef): string {
  const line = (id: string) => {
    const w = catalog.unitWeapon(id);
    return `${dataText.unitWeaponName(w)} (${damageTypeBadge(catalog, w.damageType)})`;
  };
  return cls.enemyWeapon ? t('unit.weaponLine.enemy', { weapon: line(cls.weapon), enemyWeapon: line(cls.enemyWeapon) }) : line(cls.weapon);
}

/** Extra legend lines for a class's special traits: a semi-ace shield, extra damage from aces, a heal pulse. */
export function unitTraitLines(cls: UnitClassDef): string[] {
  const lines: string[] = [];
  if (cls.shield) lines.push(t('unit.trait.shield', { duration: cls.shield.duration, cooldown: cls.shield.cooldown }));
  if (cls.aceHitMul) lines.push(t('unit.trait.aceHit', { mul: cls.aceHitMul }));
  if (cls.heal) lines.push(t('unit.trait.heal', { radius: cls.heal.radius, pct: Math.round(cls.heal.amount * 100), interval: cls.heal.interval }));
  return lines;
}

/** A hardpoint's label (hangar and HUD): the weapon's damage type. */
export function slotLabel(catalog: Catalog, def: WeaponDef): string {
  return dataText.damageName(catalog.damageType(def.damageType));
}

/** "Heavy plate: weak to Beam, resists Kinetic" for the unit legend. */
export function armorLine(catalog: Catalog, armorId: string): string {
  const armor = catalog.armor(armorId);
  const weakTo: string[] = [];
  const resists: string[] = [];
  for (const type of catalog.damageTypes) {
    const m = armor.vs[type.id] ?? 1;
    if (m > 1) weakTo.push(damageTypeBadge(catalog, type.id));
    else if (m < 1) resists.push(damageTypeBadge(catalog, type.id));
  }
  const name = dataText.armorName(armor);
  if (!weakTo.length && !resists.length) return t('armor.plain', { armor: name });
  const parts = [];
  if (weakTo.length) parts.push(t('armor.weakTo', { list: listOf(weakTo) }));
  if (resists.length) parts.push(t('armor.resists', { list: listOf(resists) }));
  return t('armor.line', { armor: name, parts: listOf(parts) });
}

/** A medal's name in its color, with a star unless `star` is false. */
export function medalBadge(name: string, star = true): string {
  return `<b class="m-${name.toLowerCase()}">${star ? '★ ' : ''}${dataText.medalName(name)}</b>`;
}
