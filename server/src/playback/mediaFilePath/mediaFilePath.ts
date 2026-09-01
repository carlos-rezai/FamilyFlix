import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

/**
 * The one check standing between a string in the database and an open file
 * handle: resolve a stored path against the managed media directory, and answer
 * with the absolute file behind it — or `null` if there is nothing there to
 * send.
 *
 * **The rule is stated on the resolved path, never on the raw string.** A check
 * that refused the substring `..` would reject
 * `A Film (2016)/../A Film (2016)/f.mp4`, which never leaves the tree, and
 * accept a directory link that leaves it without a `..` anywhere in it. So both
 * the media root and the candidate are resolved through
 * {@link realpathSync} — which follows links — and the containment test is made
 * between the two real paths.
 *
 * Resolving links is also why the root is resolved rather than trusted: a
 * temporary directory is a symlink on macOS and an 8.3 short name on Windows,
 * so a resolved candidate would otherwise never appear to sit under the root it
 * genuinely sits under.
 *
 * Every answer is a `null` rather than a throw, and deliberately the same
 * `null` in every case. A caller cannot tell a path that escaped from a file
 * that is missing, which is the point — what is or is not on this disk is not
 * something the API reports back. The media directory not existing at all is
 * one of those cases: the dev default is `./media`, which is absent until
 * something imports a film, and the routes that ask this question run before
 * that.
 *
 * @param mediaPath the managed media directory (`FAMILYFLIX_MEDIA_PATH`)
 * @param storedPath the movie's stored path, relative to that directory
 */
export function mediaFilePath(
  mediaPath: string,
  storedPath: string
): string | null {
  // An absolute stored path is refused before anything is resolved: `resolve`
  // would simply adopt it, and a row is not trusted any further than a URL.
  if (isAbsolute(storedPath)) {
    return null;
  }

  try {
    const root = realpathSync(resolve(mediaPath));
    const file = realpathSync(resolve(root, storedPath));

    if (file === root || !file.startsWith(root + sep)) {
      return null;
    }

    return statSync(file).isFile() ? file : null;
  } catch {
    // Nothing on disk to resolve — a missing file, a missing media directory,
    // or a link that dangles. All of them are "nothing to send".
    return null;
  }
}
