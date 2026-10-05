import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readSeenVersion, writeSeenVersion } from './seenVersion';

/**
 * 17 — Software update, Phase 3: "the offer snackbar and the congratulation"
 * (issue #238).
 *
 * The **Seen version** — the **App version** this machine last ran — is a
 * per-machine fact, not library data, so it lives in `localStorage` on the
 * `volumePreference` precedent. Absent on a fresh install. Whatever the
 * storage does, the launch goes on: a throwing storage reads as absent and a
 * throwing write is swallowed.
 */

/** Pinned: renaming it would congratulate every machine in the house again. */
const KEY = 'familyflix.seenVersion';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('seenVersion', () => {
  it('reads null on a machine that has never run the app', () => {
    expect(readSeenVersion()).toBeNull();
  });

  it('gives back the version that was written', () => {
    writeSeenVersion('1.1.0');

    expect(readSeenVersion()).toBe('1.1.0');
  });

  it('keeps it in localStorage under its key', () => {
    writeSeenVersion('1.2.3');

    expect(localStorage.getItem(KEY)).toBe('1.2.3');
  });

  it('reads what is already under the key', () => {
    localStorage.setItem(KEY, '0.9.0');

    expect(readSeenVersion()).toBe('0.9.0');
  });
});

describe('seenVersion — a storage that throws', () => {
  it('reads null when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(readSeenVersion()).toBeNull();
  });

  it('swallows a write that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });

    expect(() => writeSeenVersion('1.1.0')).not.toThrow();
  });
});
