/**
 * The window's rules: it can only ever be FamilyFlix. Pure, so the main
 * process only wires them to `will-navigate`, `setWindowOpenHandler` and the
 * permission handlers.
 */

/** The one permission the app asks for: the player's fullscreen. */
const GRANTED_PERMISSION = 'fullscreen';

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Whether `url` is on the app's own origin — scheme, host and port. */
export function isAppUrl(url: string, appUrl: string): boolean {
  const target = parse(url);
  const app = parse(appUrl);
  return target !== null && app !== null && target.origin === app.origin;
}

/** Whether a link may leave for the default browser: `https:` only. */
export function openExternalAllowed(url: string): boolean {
  return parse(url)?.protocol === 'https:';
}

/** Whether the page may have a permission: `fullscreen` and nothing else. */
export function permissionAllowed(permission: string): boolean {
  return permission === GRANTED_PERMISSION;
}
