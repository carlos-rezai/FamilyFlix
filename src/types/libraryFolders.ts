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

/** The IPC channels between the preload and main for the native pickers. */
export const FOLDER_CHANNELS = {
  /** invoke → `string[]`, the folders picked; `[]` for a cancel */
  pick: 'familyflix:folders:pick',
  /** invoke → `string | null`, the one folder picked; `null` for a cancel */
  pickOne: 'familyflix:folders:pick-one',
} as const;

/** `window.familyflix.folders`, as the preload defines it. */
export interface FolderBridge {
  /**
   * Open the system folder dialog; the paths picked, in order, `[]` a cancel.
   */
  pick(): Promise<string[]>;
  /** Open the system folder dialog for one folder; `null` a cancel. */
  pickOne(): Promise<string | null>;
}
