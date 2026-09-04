// @vitest-environment node
//
// What the double promises: a directory that is there, is empty, is nobody
// else's, is named after the suite that asked, is a real path rather than a
// link to one — and is gone by the next test.

import { existsSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sandboxRoot } from './sandboxRoot';

describe('sandboxRoot', () => {
  it('hands out a directory that exists and is empty', () => {
    const root = sandboxRoot('familyflix-probe-');

    expect(existsSync(root)).toBe(true);
    expect(readdirSync(root)).toEqual([]);
  });

  it('names it after the prefix the caller gave, so a leak names its suite', () => {
    expect(basename(sandboxRoot('familyflix-probe-'))).toMatch(
      /^familyflix-probe-/
    );
  });

  it('hands out a fresh one on every call', () => {
    expect(sandboxRoot('familyflix-probe-')).not.toBe(
      sandboxRoot('familyflix-probe-')
    );
  });

  it('answers a resolved path, not a link or a short name', () => {
    const root = sandboxRoot('familyflix-probe-');

    // The property `mediaFilePath` depends on: what the test builds by hand and
    // what the code under test resolves have to be the same string.
    expect(realpathSync(root)).toBe(root);
  });
});

/**
 * The sweep, pinned directly: the module-scope `afterEach` is registered once
 * per importing file, so a directory one test made — contents and all — is
 * gone by the next.
 */
describe('sandboxRoot — the sweep between tests', () => {
  let left: string;

  it('makes a directory with something in it', () => {
    left = sandboxRoot('familyflix-probe-');
    writeFileSync(join(left, 'film.mp4'), 'not really a film');

    expect(existsSync(left)).toBe(true);
  });

  it('and the next test does not find it', () => {
    expect(existsSync(left)).toBe(false);
  });
});
