/** The part of `dialog.showOpenDialog`'s answer the picker reads. */
export interface FolderDialogAnswer {
  canceled: boolean;
  filePaths: string[];
}

/**
 * The folder dialog's answer → the paths to post, in the order the dialog
 * gave them. A cancelled dialog is `[]`, never an error.
 */
export function pickFolders(answer: FolderDialogAnswer): string[] {
  return answer.canceled ? [] : [...answer.filePaths];
}

/**
 * The one-folder dialog's answer → the folder picked, or `null` for a cancel
 * or an answer that names none — the Export dialog's _Browse…_.
 */
export function pickOneFolder(answer: FolderDialogAnswer): string | null {
  if (answer.canceled) return null;
  return answer.filePaths[0] ?? null;
}
