/**
 * Translation keys for the text in the data files. The English text lives in the data itself;
 * src/i18n translates it under these keys. The sim uses them for messages built from data text.
 */
export const textKeys = {
  weaponDesc: (id: string) => `weapon.${id}.desc`,
  unitBlurb: (id: string) => `unit.${id}.blurb`,
  unitKillBanner: (id: string) => `unit.${id}.killBanner`,
  aimName: (id: string) => `aim.${id}.name`,
  aimDesc: (id: string) => `aim.${id}.desc`,
  damageName: (id: string) => `damage.${id}.name`,
  damageTrait: (id: string) => `damage.${id}.trait`,
  armorName: (id: string) => `armor.${id}.name`,
  statLabel: (stat: string) => `stat.${stat}.label`,
  medalName: (name: string) => `medal.${name}.name`,
  tutorialText: (id: string) => `tutorial.${id}.text`,
  tutorialTouchText: (id: string) => `tutorial.${id}.touchText`,
  tutorialAfterText: (id: string) => `tutorial.${id}.afterText`,
  tutorialAfterTouchText: (id: string) => `tutorial.${id}.afterTouchText`,
};
