import type { DisplayPreferenceApi } from '@/App/useDisplayPreference/useDisplayPreference';

/**
 * Build a complete `DisplayPreferenceApi` for a test, overriding only the
 * member that test cares about.
 *
 * The specimen is the blank state: every value `null` (**Blank until it
 * lands**) and every setter a resolved no-op, the state every hand-built
 * stub this replaced already used for the members it was not testing.
 *
 * The shape lives here; the specimen a test wants does not. A new display
 * preference adds its pair here, not to every suite that mounts the context,
 * `makeSettings`' rule.
 */
export function makeDisplayPreferenceApi(
  overrides: Partial<DisplayPreferenceApi> = {}
): DisplayPreferenceApi {
  return {
    ultrawideMargins: null,
    setUltrawideMargins: () => Promise.resolve(),
    tmdbRatings: null,
    setTmdbRatings: () => Promise.resolve(),
    startTab: null,
    setStartTab: () => Promise.resolve(),
    ...overrides,
  };
}
