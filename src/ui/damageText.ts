import type { Catalog } from '../data/catalog';
import { isWeapon, type ArmamentDef, type UnitClassDef } from '../data/types';

/**
 * Text for damage types and armor, shared by the hangar and HUD. Each damage type id gets
 * a CSS class `dt-<id>` (color token `--<id>` in style.css).
 */

/** The damage type's name, colored. */
export function damageTypeBadge(catalog: Catalog, typeId: string): string {
  return `<b class="dt dt-${typeId}">${catalog.damageType(typeId).name}</b>`;
}

/** Armor names this damage type hits harder (strong) or softer (weak). */
function damageTypeMatchups(catalog: Catalog, typeId: string): { strong: string[]; weak: string[] } {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const a of catalog.armors) {
    const m = a.vs[typeId] ?? 1;
    if (m > 1) strong.push(a.name);
    else if (m < 1) weak.push(a.name);
  }
  return { strong, weak };
}

/** "Strong vs Reactive armor · Weak vs Heavy plate" for a weapon card. */
export function matchupLine(catalog: Catalog, typeId: string): string {
  const { strong, weak } = damageTypeMatchups(catalog, typeId);
  const parts = [];
  if (strong.length) parts.push(`Strong vs ${strong.join(', ')}`);
  if (weak.length) parts.push(`Weak vs ${weak.join(', ')}`);
  return parts.join(' · ');
}

/** "Assault rifle (Kinetic)" for the unit legend: the class's weapon and its damage type. */
export function unitWeaponLine(catalog: Catalog, cls: UnitClassDef): string {
  const w = catalog.unitWeapon(cls.weapon);
  return `${w.name} (${damageTypeBadge(catalog, w.damageType)})`;
}

/** Extra legend lines for a class's special traits: a semi-ace shield, extra damage from aces. */
export function unitTraitLines(cls: UnitClassDef): string[] {
  const lines: string[] = [];
  if (cls.shield) lines.push(`Shield: invulnerable ${cls.shield.duration} s when hit, recharges ${cls.shield.cooldown} s`);
  if (cls.aceHitMul) lines.push(`Takes ${cls.aceHitMul}× damage from aces and semi-aces`);
  return lines;
}

/** A hardpoint's label (hangar and HUD): the weapon's damage type, or "Tool". */
export function slotLabel(catalog: Catalog, def: ArmamentDef): string {
  return isWeapon(def) ? catalog.damageType(def.damageType).name : 'Tool';
}

/** "Heavy plate: weak to Beam, resists Kinetic" for the unit legend. */
export function armorLine(catalog: Catalog, armorId: string): string {
  const armor = catalog.armor(armorId);
  const weakTo: string[] = [];
  const resists: string[] = [];
  for (const t of catalog.damageTypes) {
    const m = armor.vs[t.id] ?? 1;
    if (m > 1) weakTo.push(damageTypeBadge(catalog, t.id));
    else if (m < 1) resists.push(damageTypeBadge(catalog, t.id));
  }
  if (!weakTo.length && !resists.length) return `${armor.name} armor`;
  const parts = [];
  if (weakTo.length) parts.push(`weak to ${weakTo.join(', ')}`);
  if (resists.length) parts.push(`resists ${resists.join(', ')}`);
  return `${armor.name}: ${parts.join(', ')}`;
}
