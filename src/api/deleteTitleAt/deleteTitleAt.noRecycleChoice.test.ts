import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 52, Keep originals, Phase 4 (issue #477): a Delete keeps originals, so the
 * **Recycle choice**'s wire is gone from the client whole. No `DeleteFiles`,
 * no `DeleteOutcome` and no `?files=` query is left anywhere in `src/`, its
 * tests included: the four `*.recycle.test.tsx` suites go with it.
 */
const ROOT = 'src';
const SELF = join(
  ROOT,
  'api',
  'deleteTitleAt',
  'deleteTitleAt.noRecycleChoice.test.ts'
);
const GONE = ['DeleteFiles', 'DeleteOutcome', '?files='];

/** Every `.ts` / `.tsx` file under `dir`, this suite left out. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourcesUnder(path);
    }
    return /\.tsx?$/.test(entry.name) && path !== SELF ? [path] : [];
  });
}

describe('the Recycle choice’s wire is gone from src/', () => {
  it.each(GONE)('leaves no %s in any file', (word) => {
    const holding = sourcesUnder(ROOT).filter((path) =>
      readFileSync(path, 'utf8').includes(word)
    );

    expect(holding).toEqual([]);
  });
});
