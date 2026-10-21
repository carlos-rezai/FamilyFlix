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

/**
 * The IPC channels between the preload and main for the native pickers and
 * Open folder.
 */
export const FOLDER_CHANNELS = {
  /** invoke → `string[]`, the folders picked; `[]` for a cancel */
  pick: 'familyflix:folders:pick',
  /** invoke → `string | null`, the one folder picked; `null` for a cancel */
  pickOne: 'familyflix:folders:pick-one',
  /**
   * invoke → `string | null`, the one spreadsheet (`.xlsx` or `.csv`) picked;
   * `null` for a cancel
   */
  pickSheet: 'familyflix:folders:pick-sheet',
  /**
   * invoke, no argument → nothing: main opens the **Managed media directory**
   * in Explorer. The renderer never names a path.
   */
  openMedia: 'familyflix:folders:open-media',
} as const;

/** `window.familyflix.folders`, as the preload defines it. */
export interface FolderBridge {
  /**
   * Open the system folder dialog; the paths picked, in order, `[]` a cancel.
   */
  pick(): Promise<string[]>;
  /** Open the system folder dialog for one folder; `null` a cancel. */
  pickOne(): Promise<string | null>;
  /**
   * Open the system file dialog for one spreadsheet, `.xlsx` or `.csv`;
   * `null` a cancel — Import setup's _Browse…_.
   */
  pickSheet(): Promise<string | null>;
  /**
   * Open the **Managed media directory** in Explorer, made first if absent;
   * a failure is logged by main, never answered.
   */
  openMedia(): Promise<void>;
  /**
   * The **Path bridge**: a picked file's absolute path, over Electron's
   * `webUtils.getPathForFile` — `''` for a file with none.
   */
  pathOf(file: File): string;
}
