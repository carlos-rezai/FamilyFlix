import styled from 'styled-components';

/** The page's own scroll container on `bg2`, as `page.SeasonPage` draws it. */
export const Scroller = styled.div`
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg2};
`;
