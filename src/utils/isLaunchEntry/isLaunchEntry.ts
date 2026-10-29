/**
 * The key React Router gives the first entry of a session: the app was just
 * opened, or reloaded, rather than navigated to.
 */
const FIRST_ENTRY = 'default';

/** The parts of a router location the **Launch entry** is told by. */
export interface EntryLocation {
  pathname: string;
  search: string;
  key: string;
}

/**
 * Whether a location is the **Launch entry**: bare `/`, no query, the
 * router's `default` key. `useStartTabSettled` settles it, and it is half of
 * what makes a **Cold start**.
 */
export function isLaunchEntry({
  pathname,
  search,
  key,
}: EntryLocation): boolean {
  return pathname === '/' && search === '' && key === FIRST_ENTRY;
}
