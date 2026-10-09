import styled from 'styled-components';

/** The setup's blocks, 20px apart. */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

/** A block's small uppercase heading — _What to sync_, _Fields to fill_. */
export const GroupLabel = styled.div`
  margin: 0 0 12px 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The scope cards in a wrapping row. */
export const Scopes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

/** The field chips, wrapping 9px apart. */
export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;

/** The rating note under the chips, its star in the accent. */
export const RatingNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** What a series gets, under the rating note. */
export const SeriesNote = styled.div`
  margin-top: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textFaint};
  text-wrap: pretty;
`;

export const Star = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

/** Start and the estimate beside it. */
export const StartRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
`;

export const Estimate = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Where it is saved_'s card: the Write target rows on the surface. */
export const Targets = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/** The hairline between two **Write target rows**. */
export const TargetDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSoft};
`;

/** The note under the card while either target writes into the collection. */
export const SourceNote = styled.div`
  margin: 10px 0 0 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textFaint};
  text-wrap: pretty;
`;

/**
 * The **let-go line** under Start, in the source note's style: 10px below the
 * row, as the note sits under its card, the Stack's gap taken back.
 */
export const LetGoLine = styled(SourceNote)`
  margin-top: -10px;
`;

export const SourceNoteMono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.textDim};
`;
