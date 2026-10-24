/**
 * A **Season folder**'s name, its number in the first group that matched:
 * `Season N`, `Season 0N` or `Seizoen N`, or `SNN` anywhere in a release name,
 * standing alone between separators (so never `S01E01`), or `Specials`.
 */
const SEASON_FOLDER =
  /^(?:season|seizoen)\s*(\d{1,3})(?=$|[\s._\-[(])|(?:^|[\s._-])s(\d{1,3})(?=$|[\s._\-[(])|^(specials)$/i;

/**
 * The season a **Season folder**'s name says, or `null` for a name that is no
 * Season folder: the client mirror of the server's `seasonOf`, which groups a
 * scan into shows, here seeding the **Numbering guess**. `Season`, `Seizoen` or
 * `S` and a number opening the name, in either case, say that number, whatever
 * follows a separator (never the year in `Season 1 (2008)`); a standalone
 * `SNN` in a release name, not followed by `E` and a digit, says `NN`;
 * `Specials` and `Season 0` say 0; `S01E01` says nothing. The drift guard
 * beside `readEpisodeTag` runs both readings over one table.
 */
export function readSeasonFolder(name: string): number | null {
  const found = SEASON_FOLDER.exec(name.trim());
  if (found === null) {
    return null;
  }
  return found[3] === undefined ? Number(found[1] ?? found[2]) : 0;
}
