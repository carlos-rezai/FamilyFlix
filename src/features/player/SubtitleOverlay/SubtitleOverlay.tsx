import { Band, Box } from './SubtitleOverlay.styles';

export interface SubtitleOverlayProps {
  /** The **Cue**'s line, or `null` through a stretch with no dialogue. */
  text: string | null;
  /** Whether the **Chrome** is on screen, which the line lifts out of the way of. */
  lifted: boolean;
}

/**
 * The **Subtitle overlay**: the styled box near the foot of the picture drawing
 * the line that covers the **Absolute position**.
 *
 * **It is ours, not the browser's** — no `<track>`, no `::cue`, no native
 * captions anywhere, which is not a preference. `::cue` cannot reach this box's
 * geometry, and a native track is timed against **Element time**, so it would
 * desync by the seek distance the moment a stream path exists. Having decided
 * to draw it, we draw all of it.
 *
 * It is presentational: it is handed a line and told whether the chrome is on
 * screen, and decides nothing about which line or when.
 *
 * **Nothing is drawn at all when there is nothing to say** — not an empty box,
 * and not a transparent one. That is the state the player is in for most of a
 * film, and an empty plate hovering over the picture is exactly what the
 * prototype's `sc-if` prevents. A cue whose text is blank counts as nothing:
 * files do contain them, and a blank line is no dialogue whatever the timing
 * said.
 */
export function SubtitleOverlay({ text, lifted }: SubtitleOverlayProps) {
  if (text === null || text.trim() === '') {
    return null;
  }

  return (
    <Band $lifted={lifted}>
      <Box>{text}</Box>
    </Band>
  );
}
