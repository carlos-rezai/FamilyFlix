import styled from 'styled-components';

/**
 * The page's own scroll container, rather than the document's, and a full
 * viewport tall: the **Detail backdrop** inside is pinned to its top and is
 * `100vh` tall itself, so it covers exactly this box while the series's synopsis
 * and cast scroll over it. The two heights are coupled — change one, change
 * the other.
 */
export const Scroller = styled.div`
  position: relative;
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg};
`;
