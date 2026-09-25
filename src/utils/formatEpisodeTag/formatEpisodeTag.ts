/**
 * Spells an **Episode tag** from whichever parts it is given, two digits a
 * side at least: `S02E04` for a season and a number, `S02` for a season alone
 * (a season card's numeral), `E04` for a number alone (the season page's
 * _Resume E04_, where the season is already the page). An episode or a
 * **Next episode** can be handed over whole — it carries both parts.
 *
 * The server's `episodeTag` reads and spells the whole tag for the importer;
 * this is the client's one spelling of it.
 */
export function formatEpisodeTag({
  season,
  number,
}: {
  season?: number;
  number?: number;
}): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    (season === undefined ? '' : `S${pad(season)}`) +
    (number === undefined ? '' : `E${pad(number)}`)
  );
}
