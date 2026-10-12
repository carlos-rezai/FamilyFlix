/** `Season 01`, `Season 1`, `S01` — a **Season folder**'s name, and its number. */
const SEASON_FOLDER = /^(?:season\s*(\d{1,3})|s(\d{1,3}))$/i;

/**
 * The season a **Season folder**'s name says, or `null` for a name that is not
 * one: the client mirror of the server's `seasonOf`, which groups a scan into
 * shows. The drift guard beside `readEpisodeTag` holds the two together.
 */
export function readSeasonFolder(name: string): number | null {
  const found = SEASON_FOLDER.exec(name.trim());
  return found === null ? null : Number(found[1] ?? found[2]);
}
