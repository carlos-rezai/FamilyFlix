import { basename, dirname } from 'node:path';

import { isMetaFolder } from '../../media/folderLayout/folderLayout';

/**
 * A run's **Sheet root**, the folder a sheet's **Path cells** are joined to
 * when the matched **Title folder** holds no such file: the folder holding the
 * sheet's `_meta/` or `Meta/` folder when the sheet lies in one (an
 * Export's sheet answers its **Export folder**, a Library sheet its
 * **Library folder**), else the sheet's own folder. Pure: nothing is read.
 */
export function sheetRootOf(sheetPath: string): string {
  const folder = dirname(sheetPath);
  return isMetaFolder(basename(folder)) ? dirname(folder) : folder;
}
