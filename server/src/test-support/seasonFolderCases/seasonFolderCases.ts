/**
 * 51 — Library audit (issue #447): the **Season folder**'s one table.
 *
 * The server's `seasonOf` groups a scan into shows; the client's
 * `readSeasonFolder` seeds the **Numbering guess** off the same folder name.
 * Both units' table tests read these cases, and the drift guard runs both
 * readings over every name in them, so the two rules cannot drift apart.
 *
 * Each group is one rule of the wider reading (log 51 Q11), a name and the
 * season it says, `null` for a name that is no Season folder.
 */
export type SeasonFolderCase = readonly [name: string, season: number | null];

export const SEASON_FOLDER_CASES = {
  /** `Season N`, `Season 0N`, `Seizoen N` and `SNN`, in either case. */
  spellings: [
    ['Season 1', 1],
    ['Season 01', 1],
    ['season 1', 1],
    ['SEASON 01', 1],
    ['Season02', 2],
    ['season 12', 12],
    ['Seizoen 1', 1],
    ['Seizoen 01', 1],
    ['seizoen 2', 2],
    ['SEIZOEN 03', 3],
    ['S01', 1],
    ['s01', 1],
    ['s3', 3],
    ['  Season 4  ', 4],
  ],
  /** A spelling followed by a separator and anything, the year never the number. */
  trailing: [
    ['Season 1 (2008)', 1],
    ['season 12 (2019)', 12],
    ['Seizoen 3 (2010)', 3],
    ['SEIZOEN 2 - De Terugkeer', 2],
    ['Season 2 - The Return', 2],
    ['S04 [1080p]', 4],
    ['s02 - Bonus', 2],
  ],
  /** A release name holding a standalone `SNN` not followed by `E\d`. */
  release: [
    ['Release.Show.S01.1080p.WEB-DL', 1],
    ['release.show.s02.720p.hdtv', 2],
    ['Harbor and Vine S03 Complete', 3],
    ['Harbor_and_Vine_S04_1080p', 4],
  ],
  /** An episode tag is never a Season folder, as a name or inside one. */
  episodes: [
    ['S01E01', null],
    ['s02e03', null],
    ['Release.Show.S01E01.1080p.WEB-DL', null],
    ['Harbor.and.Vine.S01E01-E02', null],
  ],
  /** `Specials` and `Season 0` are season 0. */
  specials: [
    ['Specials', 0],
    ['specials', 0],
    ['SPECIALS', 0],
    ['Season 0', 0],
    ['Season 00', 0],
    ['season 0', 0],
  ],
  /** A film folder, or any other name, is no Season folder. */
  others: [
    ['Die.Hard.1988.1080p', null],
    ['Amelie (2001)', null],
    ['Blade Runner 2049', null],
    ['Seasons of Love (2005)', null],
    ['Season of the Witch (1973)', null],
    ['Disc 2', null],
    ['Extras', null],
    ['Season', null],
    ['Series 2', null],
    ['The Night Ferry 2', null],
  ],
} as const satisfies Record<string, readonly SeasonFolderCase[]>;

/** Every case in the table, each group's in turn. */
export const ALL_SEASON_FOLDER_CASES: readonly SeasonFolderCase[] =
  Object.values(SEASON_FOLDER_CASES).flat();
