import styled from 'styled-components';

export const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

/** One textual **Meta segment** — the year range, or the counts. */
export const MetaText = styled.span`
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textDim};
`;

export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;
