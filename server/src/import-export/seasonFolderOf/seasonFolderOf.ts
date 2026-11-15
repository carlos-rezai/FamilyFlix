import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';

/**
 * The **Season folder** a show's season lies in: the first path segment of
 * its held episodes' **Source files**, the first one that has a folder, in
 * the order given, else `spellSeasonFolder(season)`. Reads no disk.
 */
export function seasonFolderOf(
  sourceFiles: readonly (string | null)[],
  season: number
): string {
  for (const sourceFile of sourceFiles) {
    if (sourceFile === null) {
      continue;
    }
    const segments = sourceFile.split(/[/\\]/);
    if (segments.length > 1 && segments[0] !== '') {
      return segments[0];
    }
  }
  return spellSeasonFolder(season);
}
