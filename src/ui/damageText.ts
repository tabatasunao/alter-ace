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

/** "Assault rifle (Kinetic)" for the unit legend: the class's weapon and its damage type, plus its enemy-army weapon if it has one. */
export function unitWeaponLine(catalog: Catalog, cls: UnitClassDef): string {
  const line = (id: string) => {
    const w = catalog.unitWeapon(id);
    return `${w.name} (${damageTypeBadge(catalog, w.damageType)})`;
  };
  return cls.enemyWeapon ? `${line(cls.weapon)}; enemy: ${line(cls.enemyWeapon)}` : line(cls.weapon);
}

/** Extra legend lines for a class's special traits: a semi-ace shield, extra damage from aces, a heal pulse. */
export function unitTraitLines(cls: UnitClassDef): string[] {
  const lines: string[] = [];
  if (cls.shield) lines.push(`Shield: invulnerable ${cls.shield.duration} s when hit, recharges ${cls.shield.cooldown} s`);
  if (cls.aceHitMul) lines.push(`Takes ${cls.aceHitMul}× damage from aces and semi-aces`);
  if (cls.heal) lines.push(`Heals its army within ${cls.heal.radius} by ${Math.round(cls.heal.amount * 100)}% every ${cls.heal.interval} s (allied: the ace too)`);
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
