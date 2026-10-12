/**
 * Layout tokens — widths the page itself is held to, as opposed to the
 * `breakpoints` it responds at. `contentMeasure` is the **Content measure**:
 * the cap the **Content frame** holds every screen but the player to while
 * **Ultrawide margins** is on. `pageMeasure` is the **Page measure**: the one
 * centred column every column screen — Settings and its sub-pages, Import, the
 * **Movie form**, the Enrichment flow, the Season page — is drawn at, so moving
 * between them never shifts the content sideways. `backSize` is the **Back
 * button**'s square, which every screen pinned under it leaves room for.
 * Spelled once, so a wrong value is one edit.
 */
export const layout = {
  contentMeasure: '1920px',
  pageMeasure: '880px',
  backSize: '44px',
} as const;
