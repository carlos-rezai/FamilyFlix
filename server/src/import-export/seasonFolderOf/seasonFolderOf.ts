import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';

/** What `seasonFolderOf` reads of a held season: its number and episodes. */
export interface HeldSeason {
  number: number;
  episodes: readonly { sourceFile: string | null }[];
}

/**
 * The **Season folder name** a show's season lies under: the first path
 * segment of its held episodes' **Source files**, the first one that has a
 * folder, in the order held (the library reads them by number), else
 * `spellSeasonFolder(season.number)`. A Source file is stored with forward
 * slashes and split on `/`. Reads no disk.
 */
export function seasonFolderOf(season: HeldSeason): string {
  for (const { sourceFile } of season.episodes) {
    if (sourceFile === null) {
      continue;
    }
    const segments = sourceFile.split('/');
    if (segments.length > 1 && segments[0] !== '') {
      return segments[0];
    }
  }
  return spellSeasonFolder(season.number);
}
