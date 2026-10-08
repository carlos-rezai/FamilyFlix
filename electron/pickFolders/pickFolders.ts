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
