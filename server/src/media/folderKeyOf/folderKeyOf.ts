/**
 * A **Title folder**'s **Folder key**: its own name, and the title and year it
 * spells as `Title (Year)`. A series is keyed by its first year.
 */
export interface FolderKey {
  name: string;
  title: string;
  year: number;
}

/** `Title (Year)`, the whole name: a four-digit year and nothing after it. */
const FOLDER_KEY = /^(.+) \((\d{4})\)$/;

/**
 * The **Folder key** a folder's name spells, or `null` for a name the
 * **Folder layout** does not read: no year, a range, a release name, or
 * anything after the closing parenthesis.
 */
export function folderKeyOf(name: string): FolderKey | null {
  const found = FOLDER_KEY.exec(name);
  if (found === null) {
    return null;
  }
  return { name, title: found[1], year: Number(found[2]) };
}

/**
 * A **Folder key** folded for comparison: NFC, then lower case, so a name a
 * Mac spelled decomposed and one Excel saved composed fold equal.
 */
export const foldFolderKey = (name: string): string =>
  name.normalize('NFC').toLowerCase();

/** Whether two **Folder keys** are one: compared by their folds. */
export const sameFolderKey = (a: string, b: string): boolean =>
  foldFolderKey(a) === foldFolderKey(b);

/** A title and its year spelled as a **Title folder**'s name, `Title (Year)`. */
export const spellFolderKey = (title: string, year: number): string =>
  `${title} (${year})`;
