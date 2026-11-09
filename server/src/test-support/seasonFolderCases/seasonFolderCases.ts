/**
 * 58, Folder layout (issue #537): the **Season folder**'s one table.
 *
 * The server's `seasonNumberOf` reads `Season NN` only (issue #536), and the
 * client's `readSeasonFolder`, which seeds the **Numbering guess** off a
 * folder name, mirrors it. The client's table test and the drift guard read
 * these cases, the drift guard over both sides.
 *
 * Each group is one rule, a name and the season it says, `null` for a name
 * that is no Season folder. Log 51's wider spellings are kept, each now
 * answering `null`, so a reader that still reads one fails.
 */
export type SeasonFolderCase = readonly [name: string, season: number | null];

export const SEASON_FOLDER_CASES = {
  /** `Season NN`: two digits or more, in either case. */
  layout: [
    ['Season 01', 1],
    ['season 01', 1],
    ['SEASON 01', 1],
    ['Season 02', 2],
    ['season 12', 12],
    ['Season 100', 100],
  ],
  /** `Season 00` is the specials, season 0. */
  specials: [
    ['Season 00', 0],
    ['season 00', 0],
  ],
  /** Log 51's wider spellings, no Season folder of the layout. */
  wider: [
    ['Season 1', null],
    ['season 2', null],
    ['Season 0', null],
    ['Season02', null],
    ['Seizoen 01', null],
    ['Seizoen 1', null],
    ['S01', null],
    ['s3', null],
    ['Specials', null],
    ['SPECIALS', null],
  ],
  /** A spelling followed by anything is no Season folder. */
  trailing: [
    ['Season 01 (2008)', null],
    ['Season 02 - The Return', null],
    ['S04 [1080p]', null],
  ],
  /** A release name holding `SNN` is no Season folder. */
  release: [
    ['Release.Show.S01.1080p.WEB-DL', null],
    ['Harbor and Vine S03 Complete', null],
  ],
  /** An episode tag is never a Season folder. */
  episodes: [
    ['S01E01', null],
    ['Release.Show.S01E01.1080p.WEB-DL', null],
  ],
  /** A Title folder, or any other name, is no Season folder. */
  others: [
    ['Amelie (2001)', null],
    ['Seasons of Love (2005)', null],
    ['Disc 2', null],
    ['Extras', null],
    ['Season', null],
    ['Series 02', null],
  ],
} as const satisfies Record<string, readonly SeasonFolderCase[]>;

/** Every case in the table, each group's in turn. */
export const ALL_SEASON_FOLDER_CASES: readonly SeasonFolderCase[] =
  Object.values(SEASON_FOLDER_CASES).flat();
