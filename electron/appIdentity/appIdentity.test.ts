// @vitest-environment node
//
// Issue #219 — the App mark in the app. Windows groups a window and a pinned
// shortcut under an App User Model ID; without one of our own, a pinned
// FamilyFlix shows Electron's icon rather than the **App mark**. `appIdentity`
// owns the ID, and main sets it before any window exists.
//
// Issue #522: the synopsis joins it. The **Menu entry**'s `Comment` and the
// `linux` block's `synopsis` are one sentence, spelled once here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { APP_SYNOPSIS, APP_USER_MODEL_ID } from './appIdentity';

/** `electron/main.ts` with its comments stripped, so prose cannot satisfy a check. */
function mainSource(): string {
  return readFileSync(
    fileURLToPath(new URL('../main.ts', import.meta.url)),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('appIdentity', () => {
  it('names FamilyFlix io.github.carlosrezai.familyflix', () => {
    expect(APP_USER_MODEL_ID).toBe('io.github.carlosrezai.familyflix');
  });

  it('is set by main from appIdentity, before the window is created', () => {
    const source = mainSource();
    const set = source.indexOf('app.setAppUserModelId(APP_USER_MODEL_ID)');
    const window = source.indexOf('new BrowserWindow(');

    expect(source).toMatch(
      /import\s*\{[^}]*\bAPP_USER_MODEL_ID\b[^}]*\}\s*from\s*['"]\.\/appIdentity\/appIdentity['"]/
    );
    expect(set).toBeGreaterThanOrEqual(0);
    expect(window).toBeGreaterThanOrEqual(0);
    expect(set).toBeLessThan(window);
  });
});

describe('appIdentity — the synopsis', () => {
  it('is one sentence about the family movie folder', () => {
    expect(APP_SYNOPSIS).toBe(
      'A browsable library and player for the family movie folder'
    );
  });

  it('is read by main from appIdentity, which spells no synopsis of its own', () => {
    const source = mainSource();

    expect(source).toMatch(
      /import\s*\{[^}]*\bAPP_SYNOPSIS\b[^}]*\}\s*from\s*['"]\.\/appIdentity\/appIdentity['"]/
    );
    expect(source).not.toMatch(/LINUX_SYNOPSIS/);
  });

  it('is the synopsis main hands menuEntry', () => {
    expect(mainSource()).toMatch(
      /menuEntry\(\s*\{[\s\S]*?\},\s*APP_SYNOPSIS\s*\)/
    );
  });
});
