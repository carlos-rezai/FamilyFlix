// @vitest-environment node
//
// 62, Welcome tune, Phase 1 (issue #594): the shell spells its autoplay
// policy. `openWindow`'s `webPreferences` holds `autoplayPolicy:
// 'no-user-gesture-required'`, Electron's default today, written down so a
// change of default cannot silence the **Welcome tune** or the player
// unnoticed (log 62 Q16). `main.ts` is wiring, so the check reads its source.
// The line is pinned, the comment above it is not: its wording is the
// maintainer's to change.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MAIN = readFileSync(
  fileURLToPath(new URL('./main.ts', import.meta.url)),
  'utf8'
);

/** `openWindow`'s `webPreferences` block. */
function webPreferences(): string {
  const openWindow = MAIN.indexOf('function openWindow(');
  expect(openWindow).not.toBe(-1);
  const start = MAIN.indexOf('webPreferences: {', openWindow);
  expect(start).not.toBe(-1);
  const end = MAIN.indexOf('}', start);
  return MAIN.slice(start, end);
}

describe('main.ts: openWindow spells the autoplay policy', () => {
  it('holds autoplayPolicy: no-user-gesture-required in webPreferences', () => {
    expect(webPreferences()).toMatch(
      /^\s*autoplayPolicy:\s*'no-user-gesture-required',?\s*$/m
    );
  });
});
