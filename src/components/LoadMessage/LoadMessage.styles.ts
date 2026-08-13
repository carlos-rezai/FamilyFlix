import styled from 'styled-components';

/**
 * The centred block a screen shows instead of its content. Deliberately without
 * a stacking context of its own: the movie detail page needs one to clear its
 * backdrop, the browse home does not, and pushing the detail page's need in
 * here would give the home a z-index it has no use for.
 */
export const Root = styled.div`
  text-align: center;
  padding: ${({ theme }) => `${theme.space.s8} ${theme.space.s6}`};
  color: ${({ theme }) => theme.colors.textFaint};
  font-family: ${({ theme }) => theme.fonts.sans};
`;

export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 26px;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 8px;
`;

export const Body = styled.div`
  font-size: 16px;
`;

/**
 * Owns the gap above the action, so a caller passing a `Button` never has to
 * know that the block it is landing in wanted 24px of air first.
 */
export const Action = styled.div`
  margin-top: ${({ theme }) => theme.space.s5};
`;
