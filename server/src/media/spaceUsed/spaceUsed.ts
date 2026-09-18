import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * **Space used**: the bytes under a root, every file summed however deep —
 * the number the Storage card puts beside the **Managed media directory**,
 * which is the number Explorer's Properties dialog gives the same folder.
 *
 * It never throws. A root that is empty, not there yet, or not a directory
 * answers `0`, so a fresh install has a Storage card and not an error. An
 * entry the listing reports but the stat cannot reach — a file removed
 * between the two calls, a junction whose target is gone, a locked file — is
 * skipped rather than failing the walk, so one such entry never blanks the
 * card. Every entry is `stat`ed rather than trusted to its `Dirent`, which is
 * what lets a link be followed when it resolves and dropped when it does not.
 *
 * The walk knows nothing of movies: a **Stranded folder** is bytes on disk and
 * counts here, while the title count comes from the database — which is how
 * the card gets to tell the truth about both.
 *
 * A function rather than a method on `createMedia`: every test double of the
 * media domain would otherwise grow a member nobody asks for.
 */
export async function spaceUsed(root: string): Promise<number> {
  let total = 0;

  const walk = async (dir: string): Promise<void> => {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }

    for (const name of names) {
      const path = join(dir, name);
      try {
        const info = await stat(path);
        if (info.isDirectory()) {
          await walk(path);
        } else if (info.isFile()) {
          total += info.size;
        }
      } catch {
        // Gone, or unreachable, between the listing and the stat: skipped.
      }
    }
  };

  await walk(root);
  return total;
}
