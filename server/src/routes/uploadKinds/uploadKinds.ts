/**
 * What a file the maintainer picked may be **called**, at the two slots where
 * the answer is not "anything".
 *
 * One unit rather than two because there is one argument and it is made once.
 * The `accept` attribute on a picker is a convenience and never a guarantee —
 * any client can post any part — and `GET /api/images` is `express.static` over
 * the media root, which serves whatever is under there with the Content-Type
 * its extension implies. So a stored `.html` would be a page served from the
 * app's own origin, and what these two slots may hold is decided here rather
 * than trusted from the client. This is a security boundary, and splitting it
 * across two folders would split the reason it exists along with it.
 *
 * The **video** slot has no such list, and its absence is deliberate rather
 * than missing: an unplayable container is a `PlayerNotice` the player already
 * draws, and refusing an MKV at the door would refuse most of the family folder
 * to spare the family a message. Video bytes are never served by
 * `express.static` — `/stream` reads them — so the rule above does not reach
 * them.
 *
 * Both checks read the **extension** rather than the part's own `Content-Type`,
 * because the extension is what `express.static` will read on the way back out:
 * a file that claims one thing and is called another is served as what it is
 * called.
 */

/** What a **poster** may be called, lowercased, dots included. */
const POSTER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * What a **subtitle** may be called — the same four `parseSubtitle/` dispatches
 * on, and the same four the picker offers.
 */
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.sub'];

/**
 * Whether a filename ends in one of `extensions`, case folded.
 *
 * A file with no extension is refused rather than passed: the check is on what
 * the file is called, and a file called nothing in particular has not claimed
 * to be anything.
 */
function hasExtension(filename: string, extensions: string[]): boolean {
  const lower = filename.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

/** Whether a filename the client chose is one a poster may have. */
export function isPosterFilename(filename: string): boolean {
  return hasExtension(filename, POSTER_EXTENSIONS);
}

/** Whether a filename the client chose is one a subtitle track may have. */
export function isSubtitleFilename(filename: string): boolean {
  return hasExtension(filename, SUBTITLE_EXTENSIONS);
}
