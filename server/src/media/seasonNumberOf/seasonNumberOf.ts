/**
 * A **Season folder**'s name: `Season NN`, two digits or more, case folded;
 * `Season 00` the specials.
 */
const SEASON_FOLDER = /^season (\d{2,})$/i;

/**
 * The season a folder's name says, or `null` for a name that is no **Season
 * folder**: one digit, another word, or anything after the number.
 */
export function seasonNumberOf(name: string): number | null {
  const found = SEASON_FOLDER.exec(name);
  return found === null ? null : Number(found[1]);
}

/** Whether a folder's name is a **Season folder**'s. */
export const isSeasonFolder = (name: string): boolean =>
  seasonNumberOf(name) !== null;

/**
 * A season spelled as its **Season folder**'s name: `Season 01`, two digits
 * or more, `Season 00` the specials.
 */
export const spellSeasonFolder = (season: number): string =>
  `Season ${String(season).padStart(2, '0')}`;
