import styled from 'styled-components';

/**
 * The row's trailing action: "View all {count} →". The section, the heading and
 * the strip this sits in all belong to `RowSection` now — what is left here is
 * only what makes a genre row a genre row, which is this link to its full page.
 */
export const ViewAll = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

/** The chevron after the label — decorative, and hidden from assistive tech. */
export const ViewAllArrow = styled.span`
  font-size: 17px;
  line-height: 1;
`;
