// @vitest-environment node
//
// Issue #226 — one reading of the run's shape. `shellMode` is pure: from
// `app.isPackaged` and the environment it answers the **Shell mode** every
// other unit is handed — `'dev'` for `electron:dev`, `'start'` for
// `electron:start`, `'installed'` for the **Installed app**. The prod flag is
// read here and nowhere else.

import { describe, expect, it } from 'vitest';

import { shellMode } from './shellMode';

describe('shellMode', () => {
  it('reads an unpackaged run with no prod flag as dev', () => {
    expect(shellMode(false, {})).toBe('dev');
  });

  it('reads an unpackaged run with the prod flag as start', () => {
    expect(shellMode(false, { FAMILYFLIX_SHELL_PROD: '1' })).toBe('start');
  });

  it('reads a prod flag other than 1 as no flag', () => {
    expect(shellMode(false, { FAMILYFLIX_SHELL_PROD: '0' })).toBe('dev');
    expect(shellMode(false, { FAMILYFLIX_SHELL_PROD: '' })).toBe('dev');
  });

  it.each([
    ['without the prod flag', {}],
    ['with the prod flag', { FAMILYFLIX_SHELL_PROD: '1' }],
  ])('reads a packaged run as installed, %s', (_label, env) => {
    expect(shellMode(true, env)).toBe('installed');
  });
});
