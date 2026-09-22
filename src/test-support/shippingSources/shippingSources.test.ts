import { afterAll, describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { shippingSourcesMatching } from './shippingSources';

/**
 * 20 — Back navigation refactor (issue #177).
 *
 * The walk the structural guards read — the hook suite's _one Back rule_ and
 * the player feature's duration rule. A guard that finds too little passes on
 * the regression it exists for, and one that reads prose fails on a sentence,
 * so each claim below is one of those two ways to lie.
 *
 * Run over a sandbox rather than `src/`, so the files it finds are the files
 * written here and no edit elsewhere in the app can move an answer.
 */
const sandbox = mkdtempSync(join(tmpdir(), 'shippingSources-'));

function write(name: string, source: string) {
  const path = join(sandbox, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

/** A sandbox path as the walk spells it: forward slashes throughout. */
const at = (name: string) => join(sandbox, name).replace(/\\/g, '/');

write('screen/Screen.tsx', 'export const leave = () => navigate(-1);\n');
write('screen/Other.ts', 'export const open = () => navigate("/");\n');
write(
  'screen/Commented.ts',
  [
    '// A step back is navigate(-1), and this line only says so.',
    '/**',
    ' * Nor does this block: navigate(-1).',
    ' */',
    'export const nothing = 0;',
    '',
  ].join('\n')
);
write('screen/Screen.test.tsx', 'navigate(-1);\n');
write('screen/Screen.spec.ts', 'navigate(-1);\n');
write('test-support/Probe/Probe.tsx', 'navigate(-1);\n');
write('notes/readme.md', 'navigate(-1)\n');

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe('shippingSourcesMatching', () => {
  it('finds the one file whose code matches, and nothing else', () => {
    expect(shippingSourcesMatching(sandbox, /navigate\(-1\)/)).toEqual([
      at('screen/Screen.tsx'),
    ]);
  });

  it('finds nothing for a pattern that appears only in comments', () => {
    expect(shippingSourcesMatching(sandbox, /this line only says/)).toEqual([]);
    expect(shippingSourcesMatching(sandbox, /Nor does this block/)).toEqual([]);
  });

  it('never returns a test file, whichever suffix it wears', () => {
    const found = shippingSourcesMatching(sandbox, /navigate\(-1\)/);

    expect(found).not.toContain(at('screen/Screen.test.tsx'));
    expect(found).not.toContain(at('screen/Screen.spec.ts'));
  });

  it('never returns a file under test-support/', () => {
    expect(shippingSourcesMatching(sandbox, /navigate\(-1\)/)).not.toContain(
      at('test-support/Probe/Probe.tsx')
    );
  });

  it('reads only TypeScript', () => {
    expect(shippingSourcesMatching(sandbox, /navigate/).sort()).toEqual([
      at('screen/Other.ts'),
      at('screen/Screen.tsx'),
    ]);
  });
});
