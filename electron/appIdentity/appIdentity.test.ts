// @vitest-environment node
//
// Issue #219 — the App mark in the app. Windows groups a window and a pinned
// shortcut under an App User Model ID; without one of our own, a pinned
// FamilyFlix shows Electron's icon rather than the **App mark**. `appIdentity`
// owns the ID, and main sets it before any window exists.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { APP_USER_MODEL_ID } from './appIdentity';

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
