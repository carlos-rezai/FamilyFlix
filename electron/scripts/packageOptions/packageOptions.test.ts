// @vitest-environment node
//
// Issue #239 — the release feed's config. `electron:package` reads its
// arguments through `packageOptions`, pure, which `packageApp.mjs` imports as
// erasable TypeScript (`verifyDigest`'s precedent): `--dir` chooses the layout
// alone over the Platform build, and `--publish` is the one way anything is
// uploaded. The default stays `'never'`, so a local package uploads nothing;
// the release workflow passes `--publish` and gets `'always'`.
//
// Issue #513 — the platform comes in too: the **Installer** (`nsis`) on
// Windows, the **AppImage** on Linux, and a `platform` the script maps to
// electron-builder's `Platform`. Each Linux answer is asked on Windows by
// passing the platform in. Any other platform is refused in a sentence.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { packageOptions } from './packageOptions';

describe('packageOptions', () => {
  it("publishes 'never' without --publish, so a local package uploads nothing", () => {
    expect(packageOptions([], 'win32').publish).toBe('never');
    expect(packageOptions([], 'linux').publish).toBe('never');
  });

  it("publishes 'always' with --publish", () => {
    expect(packageOptions(['--publish'], 'win32').publish).toBe('always');
    expect(packageOptions(['--publish'], 'linux').publish).toBe('always');
  });

  it('builds the Installer for Windows by default', () => {
    expect(packageOptions([], 'win32')).toEqual({
      target: 'nsis',
      publish: 'never',
      platform: 'windows',
    });
    expect(packageOptions(['--publish'], 'win32').target).toBe('nsis');
  });

  it('builds the AppImage for Linux by default', () => {
    expect(packageOptions([], 'linux')).toEqual({
      target: 'AppImage',
      publish: 'never',
      platform: 'linux',
    });
    expect(packageOptions(['--publish'], 'linux').target).toBe('AppImage');
  });

  it('builds the layout alone with --dir on either platform, still publishing nothing', () => {
    expect(packageOptions(['--dir'], 'win32')).toEqual({
      target: 'dir',
      publish: 'never',
      platform: 'windows',
    });
    expect(packageOptions(['--dir'], 'linux')).toEqual({
      target: 'dir',
      publish: 'never',
      platform: 'linux',
    });
  });

  it('reads the flags in either order', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(packageOptions(['--publish', '--dir'], platform)).toEqual(
        packageOptions(['--dir', '--publish'], platform)
      );
      expect(packageOptions(['--dir', '--publish'], platform).publish).toBe(
        'always'
      );
    }
  });

  it('refuses any other platform in a sentence', () => {
    expect(() => packageOptions([], 'darwin')).toThrow(/\w+ \w+.*\./);
    expect(() => packageOptions([], 'darwin')).toThrow(/darwin/);
  });
});

// The unit is only the answer if `electron:package` asks it: the script's code
// (its comments aside) names no publish mode and no platform of its own, and
// asks before the chain builds anything, so an unknown platform is refused
// before the first step runs.
describe('electron:package', () => {
  const source = (): string =>
    readFileSync(
      fileURLToPath(new URL('../packageApp.mjs', import.meta.url)),
      'utf8'
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('takes its publish mode from packageOptions, spelling none itself', () => {
    expect(source()).toMatch(
      /import\s*\{\s*packageOptions\s*\}\s*from\s*'\.\/packageOptions\/packageOptions\.ts'/
    );
    expect(source()).not.toMatch(/publish:\s*'(never|always)'/);
  });

  it('asks packageOptions with the running platform, before the first step', () => {
    const code = source();
    const asked = code.search(
      /packageOptions\(\s*process\.argv\.slice\(2\)\s*,\s*process\.platform\s*\)/
    );
    const firstStep = code.search(/^step\(/m);

    expect(asked).toBeGreaterThan(-1);
    expect(firstStep).toBeGreaterThan(-1);
    expect(asked).toBeLessThan(firstStep);
  });

  it('maps the options platform to electron-builder, naming no Platform itself', () => {
    const code = source();

    expect(code).not.toMatch(/Platform\.(WINDOWS|LINUX|MAC)\.createTarget/);
    expect(code).toMatch(/options\.platform/);
  });
});
