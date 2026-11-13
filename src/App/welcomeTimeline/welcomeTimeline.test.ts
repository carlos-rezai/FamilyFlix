// @vitest-environment node
//
// 62, Welcome tune, Phase 2 (issue #595): the welcome's timeline lifted.
// `welcomeTimeline` gathers every number of the welcome (the drop and its
// landing step, the letters, the sweeps and the clock), so the splash, the
// provider and the score all read the same ones. Nothing drawn changes: the
// numbers are the ones the splash and the provider spelled before, and the
// intro still outlasts the last letter's sweep.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DROP_DELAYS,
  DROP_LANDING,
  DROP_MS,
  HANDOFF_MS,
  INTRO_MS,
  LETTER_MS,
  LETTER_START,
  LETTER_STEP,
  LETTER_SWEEP_MS,
  LETTER_SWEEP_START,
  LETTER_SWEEP_STEP,
  MARK_SWEEP_MS,
  MARK_SWEEP_START,
  SKIP_MS,
  STILL_HANDOFF_MS,
  STILL_INTRO_MS,
} from './welcomeTimeline';

/** The App folder, from here. */
const APP = fileURLToPath(new URL('../', import.meta.url));

/** _FamilyFlix_ has ten letters; the last is index 9. */
const LAST_LETTER = 9;

/** A unit's source with its comments stripped: code alone. */
function codeOf(path: string): string {
  return readFileSync(`${APP}${path}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('welcomeTimeline', () => {
  it('holds the numbers the welcome has always drawn', () => {
    expect({
      DROP_MS,
      DROP_DELAYS,
      DROP_LANDING,
      LETTER_START,
      LETTER_STEP,
      LETTER_MS,
      MARK_SWEEP_START,
      MARK_SWEEP_MS,
      LETTER_SWEEP_START,
      LETTER_SWEEP_STEP,
      LETTER_SWEEP_MS,
      INTRO_MS,
      HANDOFF_MS,
      STILL_INTRO_MS,
      STILL_HANDOFF_MS,
      SKIP_MS,
    }).toEqual({
      DROP_MS: 520,
      DROP_DELAYS: [0, 150],
      DROP_LANDING: 0.55,
      LETTER_START: 520,
      LETTER_STEP: 40,
      LETTER_MS: 420,
      MARK_SWEEP_START: 1000,
      MARK_SWEEP_MS: 700,
      LETTER_SWEEP_START: 1150,
      LETTER_SWEEP_STEP: 45,
      LETTER_SWEEP_MS: 380,
      INTRO_MS: 1950,
      HANDOFF_MS: 500,
      STILL_INTRO_MS: 900,
      STILL_HANDOFF_MS: 400,
      SKIP_MS: 150,
    });
  });

  it("ends the intro only once the last letter's sweep has passed", () => {
    expect(
      LETTER_SWEEP_START + LAST_LETTER * LETTER_SWEEP_STEP + LETTER_SWEEP_MS
    ).toBeLessThanOrEqual(INTRO_MS);
  });
});

describe('welcomeTimeline: the splash and the provider read it', () => {
  it("leaves no timing literal of the welcome in the splash's styles", () => {
    const styles = codeOf('WelcomeSplash/WelcomeSplash.styles.ts');

    expect(styles).not.toMatch(/\b(520|420|1000|700|1150|380)\b/);
    expect(styles).not.toMatch(/\* (40|45)\b/);
    expect(styles).not.toMatch(/\b55%/);
  });

  it('lands the drop keyframe on DROP_LANDING', () => {
    const styles = codeOf('WelcomeSplash/WelcomeSplash.styles.ts');

    expect(styles).toMatch(/DROP_LANDING/);
  });

  it('leaves no timing literal of the welcome in the provider', () => {
    const provider = codeOf('WelcomeProvider/WelcomeProvider.tsx');

    expect(provider).not.toMatch(/\b(1950|500|900|400|150)\b/);
    expect(provider).not.toMatch(
      /const (INTRO_MS|HANDOFF_MS|STILL_INTRO_MS|STILL_HANDOFF_MS|SKIP_MS)\b/
    );
  });
});
