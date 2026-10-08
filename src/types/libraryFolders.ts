/**
 * One **Library folder** as the list routes answer it: a top folder the
 * maintainer keeps movies and series in, how many titles came from it, and
 * whether the disk could reach it when the list was read.
 */
export interface LibraryFolder {
  id: string;
  /** The absolute path, as the maintainer typed it. */
  path: string;
  /** The movies and series recorded against this folder. */
  titleCount: number;
  /** Read afresh on every list: `false` for a folder the disk cannot reach. */
  reachable: boolean;
}
