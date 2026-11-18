/**
 * A **Title folder**'s **Folder key**: its own name, and the title and year it
 * spells. A name ending in `(Year)` or a range is keyed by its first year;
 * any other name is the title, verbatim, year `null`.
 */
export interface FolderKey {
  name: string;
  title: string;
  year: number | null;
}

/**
 * `Title (Year)`, the whole name: a four-digit year, or a range opened by one
 * (`2022-`, `2022–2025`), and nothing after it.
 */
const FOLDER_KEY = /^(.+) \((\d{4})(?:[-–](?:\d{4})?)?\)$/;

/** The **Folder key** a folder's name spells: every name answers one. */
export function folderKeyOf(name: string): FolderKey {
  const found = FOLDER_KEY.exec(name);
  if (found === null) {
    return { name, title: name, year: null };
  }
  return { name, title: found[1], year: Number(found[2]) };
}

/**
 * A **Folder key** folded for comparison: NFC, then lower case, so a name a
 * Mac spelled decomposed and one Excel saved composed fold equal (log 61).
 * Only compared by: a sheet or an Export still writes the folder's own bytes.
 */
export const foldFolderKey = (name: string): string =>
  name.normalize('NFC').toLowerCase();

/** Whether two **Folder keys** are one: compared by their folds. */
export const sameFolderKey = (a: string, b: string): boolean =>
  foldFolderKey(a) === foldFolderKey(b);

/**
 * A title and its year spelled as a **Title folder**'s name, `Title (Year)`;
 * the bare title for a `null` year, never `Title ()`.
 */
export const spellFolderKey = (title: string, year: number | null): string =>
  year === null ? title : `${title} (${year})`;

/**
 * A path's non-empty segments, `/` and `\` both separating, as a stored
 * **Source folder**, a Folder cell and a **Folder path** are read (log 67 Q4,
 * Q7): `Movies\Amelie (2001)/` answers `Movies` and `Amelie (2001)`.
 */
export const pathSegments = (path: string): string[] =>
  path.split(/[/\\]/).filter((segment) => segment !== '');

/**
 * The **Title folder** a **Source folder** names: its last non-empty segment,
 * split on `/` and `\` alike, so `Movies\Amelie (2001)` and `Amelie (2001)`
 * answer one **Folder key**.
 */
export const titleFolderName = (path: string): string =>
  pathSegments(path).pop() ?? '';
