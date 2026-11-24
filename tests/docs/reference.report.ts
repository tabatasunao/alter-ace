import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { loadTestCatalog } from '../helpers';
import { renderReference } from './reference';

/** `npm run docs`: rewrites docs/reference.md from the data files. */
it('writes docs/reference.md', () => {
  const path = fileURLToPath(new URL('../../docs/reference.md', import.meta.url));
  writeFileSync(path, renderReference(loadTestCatalog()), 'utf8');
  console.log(`wrote ${path}`);
});
