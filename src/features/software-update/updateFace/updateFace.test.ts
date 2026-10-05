import { describe, expect, it } from 'vitest';

import type { UpdateStatus } from '@/types/update';
import { updateFace } from './updateFace';

/**
 * 17 — Software update, Phase 1: "the bridge and the row" (issue #236).
 *
 * The About card's _Software update_ row as a table, on `zoneFace`'s
 * precedent: a status, whether a pressed check is in flight, and the clock
 * in; the line, its tone and the one button out. Four faces, with
 * installing over offered over checking over idle, and every button a
 * `Button size="md"` — a disabled one is its own `:disabled` face.
 *
 * The _Last checked_ label is computed here, at render, and does not tick:
 * _just now_ under a minute, then minutes, hours and days, and nothing at
 * all before the first check that got an answer.
 */

const NOW = new Date('2026-10-05T12:00:00.000Z');

const status = (over: Partial<UpdateStatus> = {}): UpdateStatus => ({
  offered: null,
  lastCheckedAt: null,
  installing: false,
  ...over,
});

/** `lastCheckedAt` that many milliseconds before NOW. */
const checkedAgo = (ms: number): UpdateStatus =>
  status({ lastCheckedAt: new Date(NOW.getTime() - ms).toISOString() });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('updateFace — idle', () => {
  it("says you're up to date, faint, over Check for updates", () => {
    const face = updateFace(status(), false, NOW);

    expect(face.line).toMatch(/^You.re up to date\.$/);
    expect(face.tone).toBe('faint');
    expect(face.button).toEqual({
      label: 'Check for updates',
      variant: 'secondary',
      disabled: false,
    });
  });
});

describe('updateFace — checking', () => {
  it('keeps the idle line over a disabled Checking…', () => {
    const face = updateFace(checkedAgo(5 * MINUTE), true, NOW);

    expect(face.line).toMatch(
      /^You.re up to date\. Last checked 5 minutes ago$/
    );
    expect(face.tone).toBe('faint');
    expect(face.button).toEqual({
      label: 'Checking…',
      variant: 'secondary',
      disabled: true,
    });
  });
});

describe('updateFace — offered', () => {
  it('names the offered version in the offer tone, over Update now', () => {
    const face = updateFace(status({ offered: '0.2.1' }), false, NOW);

    expect(face.line).toBe('Version 0.2.1 is available to install.');
    expect(face.tone).toBe('offer');
    expect(face.button).toEqual({
      label: 'Update now',
      variant: 'primary',
      disabled: false,
    });
  });
});

describe('updateFace — installing', () => {
  it('says Installing and restarting…, dim, over a disabled primary Updating…', () => {
    const face = updateFace(
      status({ offered: '0.2.1', installing: true }),
      false,
      NOW
    );

    expect(face.line).toBe('Installing and restarting…');
    expect(face.tone).toBe('dim');
    expect(face.button).toEqual({
      label: 'Updating…',
      variant: 'primary',
      disabled: true,
    });
  });
});

describe('updateFace — precedence', () => {
  it('puts installing over offered and checking', () => {
    const face = updateFace(
      status({ offered: '0.2.1', installing: true }),
      true,
      NOW
    );

    expect(face.line).toBe('Installing and restarting…');
  });

  it('puts offered over checking', () => {
    const face = updateFace(status({ offered: '0.2.1' }), true, NOW);

    expect(face.line).toBe('Version 0.2.1 is available to install.');
    expect(face.button.label).toBe('Update now');
  });

  it('puts checking over idle', () => {
    expect(updateFace(status(), true, NOW).button.label).toBe('Checking…');
  });
});

describe('updateFace — the Last checked label', () => {
  const line = (ms: number) => updateFace(checkedAgo(ms), false, NOW).line;

  it('is absent before the first answered check', () => {
    expect(updateFace(status(), false, NOW).line).not.toMatch(/Last checked/);
  });

  it('reads just now at 59 seconds', () => {
    expect(line(59 * SECOND)).toMatch(
      /^You.re up to date\. Last checked just now$/
    );
  });

  it('reads 1 minute ago at a minute', () => {
    expect(line(MINUTE)).toMatch(/Last checked 1 minute ago$/);
  });

  it('reads 59 minutes ago at 59 minutes', () => {
    expect(line(59 * MINUTE)).toMatch(/Last checked 59 minutes ago$/);
  });

  it('reads 1 hour ago at an hour', () => {
    expect(line(HOUR)).toMatch(/Last checked 1 hour ago$/);
  });

  it('reads hours up to a day', () => {
    expect(line(DAY - SECOND)).toMatch(/Last checked 23 hours ago$/);
  });

  it('reads 1 day ago at a day', () => {
    expect(line(DAY)).toMatch(/Last checked 1 day ago$/);
  });

  it('reads N days ago beyond', () => {
    expect(line(3 * DAY)).toMatch(/Last checked 3 days ago$/);
  });
});
