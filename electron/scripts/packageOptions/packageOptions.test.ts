// @vitest-environment node
//
// Issue #239 — the release feed's config. `electron:package` reads its
// arguments through `packageOptions`, pure, which `packageApp.mjs` imports as
// erasable TypeScript (`verifyDigest`'s precedent): `--dir` chooses the layout
// alone over the Installer, and `--publish` is the one way anything is
// uploaded. The default stays `'never'`, so a local package uploads nothing;
// the release workflow passes `--publish` and gets `'always'`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { packageOptions } from './packageOptions';

describe('packageOptions', () => {
  it("publishes 'never' without --publish, so a local package uploads nothing", () => {
    expect(packageOptions([]).publish).toBe('never');
  });

  it("publishes 'always' with --publish", () => {
    expect(packageOptions(['--publish']).publish).toBe('always');
  });

  it('builds the Installer by default', () => {
    expect(packageOptions([]).target).toBe('nsis');
    expect(packageOptions(['--publish']).target).toBe('nsis');
  });

  it('builds the layout alone with --dir, still publishing nothing', () => {
    expect(packageOptions(['--dir'])).toEqual({
      target: 'dir',
      publish: 'never',
    });
  });

  it('reads the flags in either order', () => {
    expect(packageOptions(['--publish', '--dir'])).toEqual(
      packageOptions(['--dir', '--publish'])
    );
    expect(packageOptions(['--dir', '--publish']).publish).toBe('always');
  });
});

// The unit is only the answer if `electron:package` asks it: the script's code
// (its comments aside) names no publish mode of its own.
describe('electron:package', () => {
  it('takes its publish mode from packageOptions, spelling none itself', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../packageApp.mjs', import.meta.url)),
      'utf8'
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).toMatch(
      /import\s*\{\s*packageOptions\s*\}\s*from\s*'\.\/packageOptions\/packageOptions\.ts'/
    );
    expect(source).not.toMatch(/publish:\s*'(never|always)'/);
  });
});
