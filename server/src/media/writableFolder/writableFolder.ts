import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';

/**
 * Is this path a directory this process can write into? `readableFolder`'s
 * twin for the other question about the disk, answered as a value and never
 * a throw: `false` for a file, a path nothing is at, or a folder the write
 * check refuses. The Sync's **Write targets** and an **Export** both ask it,
 * and each words a `false` its own way.
 */
export async function writableFolder(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
