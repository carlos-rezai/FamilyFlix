import type { FolderBridge } from '@/types/libraryFolders';

/**
 * The one reader of `window.familyflix?.folders`, the native folder picker
 * the **Desktop shell**'s preload defines. A browser has none, and that is a
 * state, not an error: `null`, and the page draws no _Browse…_.
 */
export function folderBridge(): FolderBridge | null {
  return window.familyflix?.folders ?? null;
}
