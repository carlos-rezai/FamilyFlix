import styled from 'styled-components';

/** The tidy rows, stacked 10px apart. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

/** One tidy, in `ProblemRow`'s card. */
export const Row = styled.div`
  padding: 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The loose video, mono at 14px in the text ink. */
export const Video = styled.div`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

/** Where it moves, `→ <folder>\`, mono at 13px in the dim ink. */
export const Destination = styled.div`
  margin-top: 4px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textDim};
  overflow-wrap: anywhere;
`;

/** _Moves with it:_ under the destination, 12.5px in the faint ink. */
export const Companions = styled.div`
  margin-top: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textFaint};
  line-height: 1.5;
`;

/** The companions' names in mono, inside _Moves with it:_. */
export const CompanionNames = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  overflow-wrap: anywhere;
`;

/** _Left where they are_, the kept list's heading. */
export const KeptHeading = styled.div`
  margin: 20px 0 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** One kept entry: its files and the reason under them. */
export const Kept = styled.div`
  & + & {
    margin-top: 10px;
  }
`;

/** A kept file, mono at 13px in the text ink. */
export const KeptFile = styled.div`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

/** Why it is kept, 13px in the faint ink. */
export const KeptReason = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The footer, its one press at the right end. */
export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`;

/** _N moved into folders of their own_, over a partial failure's list. */
export const Moved = styled.p`
  margin: 20px 0 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The count moved, in the success ink. */
export const MovedCount = styled.strong`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.success};
`;

/** One failure, _<folder>: <why>_, a 13px `danger` line. */
export const Failure = styled.p`
  margin: 4px 0 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
  overflow-wrap: anywhere;
`;

/** A refused move's sentence, one 13px `danger` line over the footer. */
export const Refusal = styled.p`
  margin: 20px 0 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;
