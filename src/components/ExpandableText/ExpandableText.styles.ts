import styled from 'styled-components';

export const Root = styled.div<{ $maxWidth: number }>`
  max-width: ${({ $maxWidth }) => $maxWidth}px;
`;

/**
 * The clamp. `-webkit-line-clamp` cuts at a line boundary and appends an
 * ellipsis, which is why it is used here rather than a height cap that would
 * slice a line of copy in half. It only takes effect inside a `-webkit-box`
 * with a vertical orient and hidden overflow, so all four declarations travel
 * together — and all four come off at once when the copy is expanded.
 */
export const Copy = styled.p<{
  $fontSize: number;
  $lines: number;
  $clamped: boolean;
}>`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: ${({ $fontSize }) => $fontSize}px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textDim};
  text-wrap: pretty;

  ${({ $clamped, $lines }) =>
    $clamped
      ? `
        display: -webkit-box;
        -webkit-line-clamp: ${$lines};
        -webkit-box-orient: vertical;
        overflow: hidden;
      `
      : ''}
`;

export const Toggle = styled.button`
  appearance: none;
  margin-top: ${({ theme }) => theme.space.s2};
  padding: 0;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.accentHover};
  }
`;
