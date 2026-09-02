/**
 * How loud the family has the films, and whether they are silenced.
 *
 * Both halves travel together because they are one state to undo: a film muted
 * at a quarter has to come back at a quarter, not at whatever the last audible
 * film happened to be.
 */
export interface VolumePreference {
  /** How loud, 0–1 — the range `video.volume` accepts, and nothing wider. */
  volume: number;
  /** Whether the film is silenced, which is not the same as turned all the way down. */
  muted: boolean;
}

/**
 * Where the preference is kept. It is a contract with browsers already in the
 * house rather than an internal name: renaming it silently is not a refactor,
 * it is resetting the volume on every machine the app is installed on.
 */
const KEY = 'familyflix.player.volume';

/**
 * A machine that has never played a film — and the answer to every way that key
 * can be nonsense, refused or absent. Full volume, unmuted, which is the state
 * a first film has to open in.
 */
export const DEFAULT_VOLUME_PREFERENCE: VolumePreference = {
  volume: 1,
  muted: false,
};

/** Whether what came back out of storage is something an element can be given. */
function isPreference(value: unknown): value is VolumePreference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { volume, muted } = value as Partial<VolumePreference>;
  return (
    typeof muted === 'boolean' &&
    typeof volume === 'number' &&
    Number.isFinite(volume) &&
    volume >= 0 &&
    volume <= 1
  );
}

/**
 * The level the next film opens at.
 *
 * `localStorage` is the least trustworthy thing the frontend talks to — a
 * browser can refuse it outright, a person can put anything under the key, and
 * an older build of this app may have written something else there. Every one
 * of those comes back as {@link DEFAULT_VOLUME_PREFERENCE}, because the
 * alternative is a throw on the way to a film, or a level outside 0–1 reaching
 * an element that throws on it.
 */
export function readVolumePreference(): VolumePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null) {
      return DEFAULT_VOLUME_PREFERENCE;
    }
    const parsed: unknown = JSON.parse(stored);
    return isPreference(parsed)
      ? { volume: parsed.volume, muted: parsed.muted }
      : DEFAULT_VOLUME_PREFERENCE;
  } catch {
    // Storage disabled by policy, an Electron partition without it, or a value
    // that is not JSON at all. All of them are a film that plays at a normal
    // volume rather than a screen that falls over.
    return DEFAULT_VOLUME_PREFERENCE;
  }
}

/**
 * Remember where the volume was left. A quota error or a refused storage is
 * swallowed: a volume change must never become an error boundary over a film
 * someone is watching.
 */
export function writeVolumePreference(preference: VolumePreference): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preference));
  } catch {
    // Nothing to do and nothing to say — the film goes on at the level it is at.
  }
}
