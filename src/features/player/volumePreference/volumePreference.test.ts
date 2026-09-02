import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  DEFAULT_VOLUME_PREFERENCE,
  readVolumePreference,
  writeVolumePreference,
} from './volumePreference';

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * How loud the family has the films is a **per-machine UI preference, not
 * library data**: the database is the wrong home for it, and it must not travel
 * with a backup of the library to a machine whose speakers are nothing like
 * this one's. So it lives in `localStorage`, and this is the one place that
 * touches it.
 *
 * Everything below is about the same claim from different sides: **whatever is
 * in that key, the player still works.** `localStorage` is the least
 * trustworthy thing the frontend talks to — a browser can refuse it outright, a
 * user can clear it mid-session, and anything at all can be sitting under the
 * key, including something an older build of this app wrote. Every one of those
 * has to come back as a sane level rather than as a throw on the way to a film.
 */

/**
 * Where the preference is kept. Pinned rather than discovered, because the key
 * is a contract with browsers already in the house: renaming it silently is not
 * a refactor, it is resetting the volume on every machine the app is installed
 * on.
 */
const KEY = 'familyflix.player.volume';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('volumePreference', () => {
  it('gives back the level and the mute state that were stored', () => {
    writeVolumePreference({ volume: 0.35, muted: false });

    expect(readVolumePreference()).toEqual({ volume: 0.35, muted: false });
  });

  it('remembers a film that was silenced, which is not the same as turned down', () => {
    // Muted with a level underneath is the state the mute button exists to give
    // back, so both halves have to survive together or unmuting wakes the house.
    writeVolumePreference({ volume: 0.25, muted: true });

    expect(readVolumePreference()).toEqual({ volume: 0.25, muted: true });
  });

  it('opens at full volume, unmuted, on a machine that has never played one', () => {
    expect(readVolumePreference()).toEqual({ volume: 1, muted: false });
    expect(DEFAULT_VOLUME_PREFERENCE).toEqual({ volume: 1, muted: false });
  });
});

/**
 * The nonsense the acceptance criterion names, spelled out: every one of these
 * is something that can genuinely be sitting under that key, and every one of
 * them has to leave the player at a sane default rather than throwing on the
 * way to a film.
 */
describe('volumePreference — a key holding nonsense', () => {
  it('falls back when what is stored is not JSON at all', () => {
    localStorage.setItem(KEY, 'loud');

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('falls back when it is JSON of the wrong shape', () => {
    localStorage.setItem(KEY, JSON.stringify([0.5, false]));

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('falls back when the level is missing', () => {
    localStorage.setItem(KEY, JSON.stringify({ muted: true }));

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('falls back when the level is not a number', () => {
    localStorage.setItem(KEY, JSON.stringify({ volume: '0.4', muted: false }));

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('falls back when the level is outside the range an element has', () => {
    // 0–1 is the whole of what `video.volume` accepts; anything else throws
    // when it reaches the element, which is a film that will not open.
    for (const volume of [-0.2, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      localStorage.setItem(KEY, JSON.stringify({ volume, muted: false }));

      expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
    }
  });

  it('falls back when the mute state is not a boolean', () => {
    localStorage.setItem(KEY, JSON.stringify({ volume: 0.4, muted: 'yes' }));

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('falls back when the value is null', () => {
    localStorage.setItem(KEY, JSON.stringify(null));

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });
});

/**
 * A `localStorage` that is not merely empty but hostile. Both of these are real
 * browsers rather than hypotheticals — storage disabled by policy, a quota
 * refused, an Electron partition without it — and neither may reach the family
 * as anything other than a film that plays at a normal volume.
 */
describe('volumePreference — storage that will not co-operate', () => {
  it('falls back when reading it throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('swallows a write that throws, rather than taking the film down with it', () => {
    // A quota error on a volume change must not become an error boundary over
    // a film someone is watching.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });

    expect(() =>
      writeVolumePreference({ volume: 0.5, muted: false })
    ).not.toThrow();
  });

  it('falls back when there is no storage on the window at all', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readVolumePreference()).toEqual(DEFAULT_VOLUME_PREFERENCE);
  });

  it('writes nothing, and throws nothing, when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() =>
      writeVolumePreference({ volume: 0.5, muted: true })
    ).not.toThrow();
  });
});
