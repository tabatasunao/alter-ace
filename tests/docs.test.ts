import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReference } from './docs/reference';
import { loadTestCatalog } from './helpers';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');

/** Every Markdown page whose links should resolve: the docs folder plus the top-level guides. */
const PAGES = [
  'README.md',
  'AGENTS.md',
  ...readdirSync(join(root, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
];

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function anchors(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const line of withoutCode(markdown).split('\n')) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = m[1]!
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
}

/** The page with fenced code blocks blanked out, so diagrams and examples aren't read as links. */
function withoutCode(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, '');
}

/** Relative links on a page that point at a missing file or a missing heading. */
function brokenLinks(page: string): string[] {
  const text = read(page);
  const broken: string[] = [];
  for (const [, target] of withoutCode(text).matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target!)) continue; // http:, https:, mailto:
    const [path, anchor] = target!.split('#') as [string, string | undefined];
    const file = path ? normalize(join(dirname(page), path)) : page;
    if (!existsSync(join(root, file))) {
      broken.push(`${target} (no file ${file})`);
      continue;
    }
    if (anchor && file.endsWith('.md') && !anchors(read(file)).has(anchor)) broken.push(`${target} (no heading #${anchor} in ${file})`);
  }
  return broken;
}

describe('docs', () => {
  it('reference.md matches the data (run `npm run docs` after changing public/data)', () => {
    expect(read('docs/reference.md')).toBe(renderReference(loadTestCatalog()));
  });

  it.each(PAGES)('%s has no broken relative links or anchors', (page) => {
    expect(brokenLinks(page)).toEqual([]);
  });

  it('every page in docs/ is linked from the docs hub', () => {
    const hub = read('docs/README.md');
    const unlinked = PAGES.filter((p) => p.startsWith('docs/') && p !== 'docs/README.md').filter((p) => !hub.includes(`](${p.slice(5)}`));
    expect(unlinked).toEqual([]);
  });
});
