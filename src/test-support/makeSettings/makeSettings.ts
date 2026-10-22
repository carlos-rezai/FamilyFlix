import {
  DEFAULT_AUDIO_LANGUAGE,
  DEFAULT_START_TAB,
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_TMDB_RATINGS,
  DEFAULT_ULTRAWIDE_MARGINS,
  type Settings,
} from '@/types';

/**
 * Build a complete `Settings` for a test, overriding only what that test
 * cares about.
 *
 * The specimen is the household's defaults, built from the shared
 * `DEFAULT_*` constants, so a new preference's default is spelled once and
 * reaches every fixture through this builder alone.
 *
 * The record's *shape* lives here; the *specimen* a test wants does not. A
 * file that needs a different household passes overrides at its call site,
 * `makeMovie`'s rule: the builder never grows a parameter per specimen.
 */
export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    subtitleLanguage: DEFAULT_SUBTITLE_LANGUAGE,
    audioLanguage: DEFAULT_AUDIO_LANGUAGE,
    ultrawideMargins: DEFAULT_ULTRAWIDE_MARGINS,
    tmdbRatings: DEFAULT_TMDB_RATINGS,
    startTab: DEFAULT_START_TAB,
    ...overrides,
  };
}
