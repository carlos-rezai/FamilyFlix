import styled from 'styled-components';

/**
 * The page's own scroll container, `SeriesPage`'s: a full viewport tall on the
 * page background, so the **Detail backdrop** inside, pinned to its top and
 * `100vh` tall itself, covers exactly this box while the episodes scroll over
 * it. The two heights are coupled; change one, change the other.
 *
 * The scrollbar's gutter is held on both edges, as the **Maintainer surface**
 * held it, so the column centres on the same line whether or not the season is
 * long enough to scroll.
 */
export const Scroller = styled.div`
  position: relative;
  height: 100vh;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
  background: ${({ theme }) => theme.colors.bg};
`;
