import styled from 'styled-components';

/**
 * The **Maintainer surface**: the sheet every column screen is drawn on — a
 * full-height scroll container on the deeper background, and one centred
 * column at the **Page measure**, padded `s4 s6 s8` so a screen's heading opens
 * on the **Back button**'s line.
 *
 * `MainLayout` is deliberately not above any of them. The logo and the gear
 * are app-wide navigation for the **Family**'s screens; these are reached from
 * a screen behind them, and the Back button is the only way out.
 */

/**
 * The sheet: the viewport, once, on the deeper background, and it scrolls. Its
 * side padding is the room the pinned Back button needs beside the column's
 * own, so a narrow window never slides the heading under it. The scrollbar's
 * gutter is held whether or not the screen is tall enough to scroll, so a long
 * screen like Settings centres its column on the same line as a short one.
 */
export const Sheet = styled.div`
  height: 100vh;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
  padding: 0
    ${({ theme }) => `calc(${theme.layout.backSize} + ${theme.space.s4})`};
  background: ${({ theme }) => theme.colors.bg2};
`;

/** The centred column everything sits in, at the one Page measure. */
export const Column = styled.div`
  max-width: ${({ theme }) => theme.layout.pageMeasure};
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.space.s4} ${theme.space.s6} ${theme.space.s8}`};
`;
