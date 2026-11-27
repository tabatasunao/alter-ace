import type { Tone } from '../sim/entities';

/** Colors for the canvas, read from the CSS custom properties in style.css (the theme's single source). */
export interface Palette {
  readonly field: string;
  readonly grid: string;
  readonly gridMajor: string;
  readonly gridLabel: string;
  readonly ally: string;
  readonly enemy: string;
  readonly semiAce: string;
  readonly accent: string;
  readonly ace: string;
  /** Super release: its gauge, ring, chip and callouts. */
  readonly release: string;
  readonly emp: string;
  readonly danger: string;
  readonly muted: string;
  readonly allyShot: string;
  readonly enemyShot: string;
  readonly aceShot: string;
  readonly ring: string;
  readonly aimLine: string;
  readonly fontDisplay: string;
  tone(tone: Tone): string;
  /** A tone at low opacity (fills, halos, trails). */
  dim(tone: Tone): string;
  /** A tone at very low opacity (aura and shield fills). */
  aura(tone: Tone): string;
  /** A damage type's color (CSS token `--<id>`, as on the hangar's type badges); accent if unknown. */
  damageType(id: string | null): string;
}

/** The palette with tone `from` drawn as tone `to` (its full, dim and aura shades); everything else unchanged. */
export function recolorTone(palette: Palette, from: Tone, to: Tone): Palette {
  const swap = (t: Tone) => (t === from ? to : t);
  return { ...palette, tone: (t) => palette.tone(swap(t)), dim: (t) => palette.dim(swap(t)), aura: (t) => palette.aura(swap(t)) };
}

export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function readPalette(root: Element = document.documentElement): Palette {
  const styles = getComputedStyle(root);
  const token = (name: string) => styles.getPropertyValue(name).trim() || '#ffffff';
  const base = {
    field: token('--field'),
    grid: token('--grid'),
    gridMajor: token('--grid-major'),
    gridLabel: token('--grid-label'),
    ally: token('--ally'),
    enemy: token('--enemy'),
    semiAce: token('--semi-ace'),
    accent: token('--accent'),
    ace: token('--ace'),
    release: token('--release'),
    emp: token('--emp'),
    danger: token('--danger'),
    muted: token('--muted'),
  };
  const tones: Record<Tone, string> = {
    ally: base.ally,
    enemy: base.enemy,
    semiAce: base.semiAce,
    ace: base.ace,
    accent: base.accent,
    danger: base.danger,
    release: base.release,
  };
  const typeColors = new Map<string, string>();
  const shade = (alpha: number) => Object.fromEntries(Object.entries(tones).map(([t, c]) => [t, withAlpha(c, alpha)])) as Record<Tone, string>;
  const dims = { ...shade(0.25), semiAce: withAlpha(base.semiAce, 0.35) };
  const auras = { ...shade(0.08), semiAce: withAlpha(base.semiAce, 0.1) };
  return {
    ...base,
    allyShot: withAlpha(base.ally, 0.85),
    enemyShot: withAlpha(base.enemy, 0.9),
    aceShot: withAlpha(base.accent, 0.95),
    ring: withAlpha(base.accent, 0.24),
    aimLine: withAlpha(base.accent, 0.2),
    fontDisplay: styles.getPropertyValue('--font-display').trim() || 'monospace',
    tone: (t) => tones[t],
    dim: (t) => dims[t],
    aura: (t) => auras[t],
    damageType: (id) => {
      if (!id) return base.accent;
      let c = typeColors.get(id);
      if (!c) typeColors.set(id, (c = styles.getPropertyValue(`--${id}`).trim() || base.accent));
      return c;
    },
  };
}
