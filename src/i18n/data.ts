import type { Catalog } from '../data/catalog';
import { textKeys as k } from '../data/textKeys';
import type { ArmorDef, AimModeDef, DamageTypeDef, FrameStat, UnitClassDef, UnitWeaponDef, WeaponDef } from '../data/types';
import { td } from './index';

/**
 * Names and descriptions from the data files, in the current language. English lives in the data
 * files themselves; the other languages translate them under `textKeys`. Proper nouns (weapon,
 * unit class, unit weapon and preset names) stay in English in every language.
 */
export const dataText = {
  weaponName: (w: WeaponDef) => w.name,
  weaponDesc: (w: WeaponDef) => td(k.weaponDesc(w.id), w.desc),
  unitName: (c: UnitClassDef) => c.name,
  unitBlurb: (c: UnitClassDef) => td(k.unitBlurb(c.id), c.blurb),
  unitWeaponName: (w: UnitWeaponDef) => w.name,
  aimName: (m: AimModeDef) => td(k.aimName(m.id), m.name),
  aimDesc: (m: AimModeDef) => td(k.aimDesc(m.id), m.desc),
  damageName: (t: DamageTypeDef) => td(k.damageName(t.id), t.name),
  damageTrait: (t: DamageTypeDef) => td(k.damageTrait(t.id), t.trait),
  armorName: (a: ArmorDef) => td(k.armorName(a.id), a.name),
  statLabel: (catalog: Catalog, s: FrameStat) => td(k.statLabel(s), catalog.frameBuild.stats[s].label),
  presetName: (name: string) => name,
  medalName: (name: string) => td(k.medalName(name), name),
};

/** Every translatable data string, keyed as `dataText` looks them up, with its English text (for translators and tests). */
export function dataStrings(catalog: Catalog): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of catalog.weapons) out[k.weaponDesc(w.id)] = w.desc;
  for (const c of catalog.classes) {
    out[k.unitBlurb(c.id)] = c.blurb;
    if (c.killBanner) out[k.unitKillBanner(c.id)] = c.killBanner;
  }
  for (const m of catalog.aimModes) {
    out[k.aimName(m.id)] = m.name;
    out[k.aimDesc(m.id)] = m.desc;
  }
  for (const t of catalog.damageTypes) {
    out[k.damageName(t.id)] = t.name;
    out[k.damageTrait(t.id)] = t.trait;
  }
  for (const a of catalog.armors) out[k.armorName(a.id)] = a.name;
  for (const [s, def] of Object.entries(catalog.frameBuild.stats)) out[k.statLabel(s)] = def.label;
  for (const m of catalog.loadout.medals) out[k.medalName(m.name)] = m.name;
  for (const s of catalog.armies.tutorial.stages) {
    out[k.tutorialText(s.id)] = s.text;
    out[k.tutorialTouchText(s.id)] = s.touchText;
    if (s.afterText) out[k.tutorialAfterText(s.id)] = s.afterText;
    if (s.afterTouchText) out[k.tutorialAfterTouchText(s.id)] = s.afterTouchText;
  }
  return out;
}
