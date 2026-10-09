import styled from 'styled-components';

/**
 * The art layer, pinned to the top of the page's scroller and a full viewport
 * tall; the negative margin gives its height back, so the content scrolls up
 * over it from the top of the page.
 *
 * Coupled: the `100vh` here is the height of both pages' scrollers
 * (`MoviePage`'s and `SeriesPage`'s `Scroller`). Change one, change the other.
 */
export const ArtArea = styled.div`
  position: sticky;
  top: 0;
  height: 100vh;
  margin-bottom: -100vh;
  overflow: hidden;
`;

/**
 * The **Backdrop veil**: a darkening gradient that lands on the page
 * background, over a faint wash of the theme's own `accentSoft`.
 */
export const Veil = styled.div`
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(20, 17, 13, 0.65) 0%,
      rgba(20, 17, 13, 0.85) 50%,
      ${({ theme }) => theme.colors.bg} 100%
    ),
    ${({ theme }) => theme.colors.accentSoft};
`;
