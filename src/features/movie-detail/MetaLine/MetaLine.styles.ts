import styled from 'styled-components';

export const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

/** One textual **Meta segment** — the year, or the runtime. */
export const MetaText = styled.span`
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textDim};
`;

export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** Keeps the stars and their numeric value together on one unbreakable line. */
export const RatingWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
`;

export const WatchedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.watched};
  background: rgba(138, 154, 107, 0.14);
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;
