/** A **Season folder**'s name: `Season N`, any number of digits, case folded. */
const SEASON_FOLDER = /^season (\d+)$/i;

/**
 * The season a **Season folder**'s name says, or `null` for a name that is no
 * Season folder: the client mirror of the server's `seasonNumberOf`, which
 * reads a scan and groups it into shows, here seeding the **Numbering
 * guess**. Only `Season N`, any number of digits, case folded, and nothing
 * else, says its number; `Season 0` says 0. The drift guard beside
 * `readEpisodeTag` runs both readings over one table.
 */
export function readSeasonFolder(name: string): number | null {
  const found = SEASON_FOLDER.exec(name);
  return found === null ? null : Number(found[1]);
}
