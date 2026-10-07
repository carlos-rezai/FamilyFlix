/**
 * Layout tokens — widths the page itself is held to, as opposed to the
 * `breakpoints` it responds at. `contentMeasure` is the **Content measure**:
 * the cap the **Content frame** holds every screen but the player to while
 * **Ultrawide margins** is on. Spelled once, so a wrong 1920px is one edit.
 */
export const layout = {
  contentMeasure: '1920px',
} as const;
