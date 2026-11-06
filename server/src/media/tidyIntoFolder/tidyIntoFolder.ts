import { mkdir, rename, rmdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { Tidy } from '@/types';

/** What one move answers: done, or the sentence saying why not. */
export type TidyMove = { ok: true } | { ok: false; reason: string };

const OPEN = "It's open in another app.";
/** The sentence a move answers when its root has gone out of reach. */
export const UNREACHABLE = "The folder can't be reached right now.";
const REFUSED = 'The disk refused the move.';
const clash = (folder: string): string =>
  `A folder called “${folder}” is already here.`;

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;

/** Is the root still a folder this process can see? */
async function reachable(root: string): Promise<boolean> {
  try {
    return (await stat(root)).isDirectory();
  } catch {
    return false;
  }
}

/** The sentence an error from the move reads as. */
async function reasonOf(
  error: unknown,
  root: string,
  folder: string
): Promise<string> {
  const code = codeOf(error);
  if (code === 'EBUSY' || code === 'EPERM') {
    return OPEN;
  }
  if (code === 'EEXIST') {
    return clash(folder);
  }
  if (!(await reachable(root))) {
    return UNREACHABLE;
  }
  return REFUSED;
}

/**
 * The media domain's one mover: a **Tidy**'s videos, then each **Companion
 * file**, renamed into the **Tidy folder name** it makes under `root` with an
 * exclusive `mkdir`; all or nothing. A failure renames back what moved, in
 * reverse, and removes the folder it made; a rollback that fails itself
 * keeps the folder and says where the files are. Renames only, never a copy,
 * and answered as a value, never a throw.
 */
export async function tidyIntoFolder(
  root: string,
  tidy: Tidy
): Promise<TidyMove> {
  const folder = join(root, tidy.folder);
  try {
    await mkdir(folder);
  } catch (error: unknown) {
    return { ok: false, reason: await reasonOf(error, root, tidy.folder) };
  }

  const moved: string[] = [];
  try {
    for (const name of [...tidy.videos, ...tidy.companions]) {
      await rename(join(root, name), join(folder, name));
      moved.push(name);
    }
    return { ok: true };
  } catch (error: unknown) {
    const reason = await reasonOf(error, root, tidy.folder);
    let rolledBack = true;
    for (const name of moved.reverse()) {
      try {
        await rename(join(folder, name), join(root, name));
      } catch {
        rolledBack = false;
      }
    }
    if (!rolledBack) {
      return {
        ok: false,
        reason: `${reason} Some of its files are in “${tidy.folder}”.`,
      };
    }
    try {
      await rmdir(folder);
    } catch {
      // The folder stays; every file is back where it was.
    }
    return { ok: false, reason };
  }
}
