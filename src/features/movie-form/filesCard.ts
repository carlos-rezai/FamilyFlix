/**
 * What both Files cards of the **Movie form** say the same way: what each
 * kind of file dialog offers, the card's caption and the poster slot's names.
 * Labels only one card draws stay with that card.
 */

/**
 * What the video slot offers a file dialog, and the series' episode picker
 * with it.
 *
 * Chromium gives MKV and AVI no MIME type at all, so `video/*` on its own would
 * grey out most of the family folder — the extensions are named beside it for
 * exactly the containers a browser will not name. It is a convenience and never
 * a guarantee: the server re-checks, and accepts an unplayable container rather
 * than refusing it, because `cannot-play` is a state the player is designed to
 * draw.
 */
export const VIDEO_ACCEPT = 'video/*,.mkv,.avi';

/**
 * What the poster slot offers a file dialog.
 *
 * The mirror of the video slot's list, and the reason that one is long: every
 * image container a poster arrives in has a MIME type a browser will name, so
 * `image/*` is the whole of what this slot has to say. It is a convenience just
 * the same — the server decides what a poster may be called, by extension,
 * because a file under the media root is served with the Content-Type its
 * extension implies.
 */
export const POSTER_ACCEPT = 'image/*';

/**
 * What a subtitle picker offers a file dialog: the same four extensions
 * `parseSubtitle/` dispatches on, because a file the player could never read is
 * not one the dialog should offer.
 *
 * No MIME type beside them, unlike the two slots above — a browser calls a
 * `.srt` `text/plain` if it names it at all, and `text/plain` would offer the
 * maintainer every note in the folder. The server re-checks by extension
 * anyway, and refuses what this list is only asking for.
 */
export const SUBTITLE_ACCEPT = '.srt,.vtt,.ass,.sub';

/** The caption over the card. */
export const CARD_LABEL = 'Files';

/** The poster slot's name, and what its picker says. */
export const POSTER_LABEL = 'Poster';
export const POSTER_CHOOSE = 'Choose poster image';
