import { LIBRARY_TABS, type LibraryTab } from '@/types';

/**
 * Whether a value is one of the tabs in {@link LIBRARY_TABS}, exactly.
 *
 * A util rather than a feature-local helper because the tab arrives from
 * outside in two places: the URL names the tab the library is showing, and
 * the settings route echoes the **Start tab** it stored. Neither may treat
 * what it finds as a `LibraryTab` without asking here first. It takes
 * `unknown`, not `string` as `isMovieSort` does, because the echo is not
 * known to be a string.
 *
 * The list it checks against is the shared one, so this guard cannot come to
 * recognise a different set of tabs than the type names.
 */
export function isLibraryTab(value: unknown): value is LibraryTab {
  return (
    typeof value === 'string' &&
    (LIBRARY_TABS as readonly string[]).includes(value)
  );
}
