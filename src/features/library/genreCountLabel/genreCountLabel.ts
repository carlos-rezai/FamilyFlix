/**
 * The count line under a genre's name: how many movies the grid is showing, and
 * how many the genre really holds.
 *
 * Two numbers rather than one because the second must not move while a search
 * narrows the first — "12 of 214 titles" is what keeps the screen honest
 * against the "View all 214" that opened it, and it is also what tells a genre
 * holding nothing ("0 titles") apart from a genre whose search found nothing
 * ("0 of 214 titles").
 *
 * The noun follows `all`, not `shown`: the sentence is counting the genre, so a
 * search narrowing 214 movies down to one still reads "1 of 214 titles". Only a
 * genre that really holds one movie is singular. The prototype's `all + ' titles'`
 * said "1 titles" there — a copy bug, amended in `docs/handoff/` before this was
 * written, so this follows the prototype rather than disagreeing with it.
 *
 * Pure, so the same pair always reads the same way.
 */
export function genreCountLabel(shown: number, all: number): string {
  const titles = all === 1 ? 'title' : 'titles';
  return shown === all ? `${all} ${titles}` : `${shown} of ${all} ${titles}`;
}
