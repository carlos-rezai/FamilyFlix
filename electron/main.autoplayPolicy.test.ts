// @vitest-environment node
//
// 62, Welcome tune, Phase 1 (issue #594): the shell spells its autoplay
// policy. `openWindow`'s `webPreferences` holds `autoplayPolicy:
// 'no-user-gesture-required'`, Electron's default today, written down with a
// line saying the **Welcome tune** and the player rely on it, so a change of
// default cannot silence either unnoticed. `main.ts` is wiring, so the check
// reads its source.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MAIN = readFileSync(
  fileURLToPath(new URL('./main.ts', import.meta.url)),
  'utf8'
);

/** `openWindow`'s `webPreferences` block, its comments kept. */
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

  it('says on its line that the Welcome tune and the player rely on it', () => {
    const lines = webPreferences().split(/\r?\n/);
    const at = lines.findIndex((line) => /autoplayPolicy:/.test(line));
    expect(at).toBeGreaterThan(0);

    let comment = '';
    for (let i = at - 1; i >= 0 && /^\s*(\/\/|\/?\*)/.test(lines[i]); i -= 1) {
      comment = `${lines[i]} ${comment}`;
    }
    expect(comment).toMatch(/Welcome tune/);
    expect(comment).toMatch(/player/i);
  });
});
