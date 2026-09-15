import { extname } from 'node:path';

/**
 * What a file the store will hold may be **called**, at the two slots where
 * the answer is not "anything" — and what a file on the shelf is called for
 * the scanner to take it as a video.
 *
 * One unit rather than two because there is one argument and it is made once.
 * The `accept` attribute on a picker is a convenience and never a guarantee —
 * any client can post any part — and `GET /api/images` is `express.static` over
 * the media root, which serves whatever is under there with the Content-Type
 * its extension implies. So a stored `.html` would be a page served from the
 * app's own origin, and what these two slots may hold is decided here rather
 * than trusted from the client. This is a security boundary, and splitting it
 * across two folders would split the reason it exists along with it. It lives
 * in `media/` because the argument is about the media root — the store decides
 * what it will hold — and the routes read it from here as they read `Media`.
 *
 * The **video** slot has no such list, and its absence is deliberate rather
 * than missing: an unplayable container is a `PlayerNotice` the player already
 * draws, and refusing an MKV at the door would refuse most of the family folder
 * to spare the family a message. Video bytes are never served by
 * `express.static` — `/stream` reads them — so the rule above does not reach
 * them. {@link isVideoFilename} is a different rule with a different reason: a
 * scanner deciding which folder on the shelf is a film has to draw a line, and
 * the form's video slot deliberately does not consult it.
 *
 * Every check reads the **extension** rather than the part's own `Content-Type`,
 * because the extension is what `express.static` will read on the way back out:
 * a file that claims one thing and is called another is served as what it is
 * called.
 */

/** What an **image** — a **Poster** or **Backdrop** — may be called, lowercased. */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * What a **subtitle** may be called — the same four `parseSubtitle/` dispatches
 * on, and the same four the picker offers.
 */
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.sub'];

/**
 * What makes a folder a **Source folder**: a file with one of these
 * extensions in it. The scanner's list and only the scanner's — see the note
 * on the video slot above.
 */
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

/**
 * Whether a filename's extension is one of `extensions`, case folded.
 *
 * A file with no extension is refused rather than passed: the check is on what
 * the file is called, and a file called nothing in particular has not claimed
 * to be anything. The extension is the last one — `poster.png.html` is called
 * `.html`, whatever the name before it reads as.
 */
function hasExtension(filename: string, extensions: string[]): boolean {
  return extensions.includes(extname(filename).toLowerCase());
}

/** Whether a filename is one an image — a **Poster**, a **Backdrop** — may have. */
export function isImageFilename(filename: string): boolean {
  return hasExtension(filename, IMAGE_EXTENSIONS);
}

/** Whether a filename the client chose is one a subtitle track may have. */
export function isSubtitleFilename(filename: string): boolean {
  return hasExtension(filename, SUBTITLE_EXTENSIONS);
}

/** Whether a filename is one the scanner takes for a video. */
export function isVideoFilename(filename: string): boolean {
  return hasExtension(filename, VIDEO_EXTENSIONS);
}
