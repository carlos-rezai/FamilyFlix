import styled from 'styled-components';

export const Root = styled.section`
  margin-bottom: ${({ theme }) => theme.space.s7};
`;

/**
 * The row's own heading, with no "View all" beside it — Continue Watching is
 * not a genre and has no full page, so the header is the title alone and the
 * title carries the section's padding itself.
 */
export const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.text};
  margin: ${({ theme }) => `0 0 ${theme.space.s4}`};
  padding: ${({ theme }) => `0 ${theme.space.s6}`};
`;
