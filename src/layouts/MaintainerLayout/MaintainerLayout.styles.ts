import styled from 'styled-components';

/**
 * The **Maintainer surface**: the sheet every maintainer screen is drawn on.
 * `feat.MovieForm.dc.html`, `page.SettingsPage.dc.html` and
 * `feat.ImportFlow.dc.html` each open with the same two blocks — a full-height
 * scroll container on the deeper background, and a centred column padded
 * `s6 s6 s8` and capped at a measure — and this is where they are written
 * once, on `chrome.styles.ts`'s reasoning: a layout each screen composes rather
 * than a base class one screen inherits from.
 *
 * `MainLayout` is deliberately not above any of them. The logo and the gear
 * are app-wide navigation for the **Family**'s screens; these are reached from
 * Settings, whose own header carries the gear, and a gear on Settings is a
 * control that does nothing. The back pill is the only way out — the same call
 * `MoviePage` and `GenreLayout` each made for their own reasons.
 */

/** The sheet: the viewport, once, on the deeper background, and it scrolls. */
export const Sheet = styled.div`
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg2};
`;

/** The centred column everything sits in, at the measure the screen asks for. */
export const Column = styled.div<{ $width: number }>`
  max-width: ${({ $width }) => `${$width}px`};
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.space.s6} ${theme.space.s6} ${theme.space.s8}`};
`;
