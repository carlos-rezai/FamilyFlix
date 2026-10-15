import styled from 'styled-components';
import { GOLD, type DotTone } from '../ProblemRow/ProblemRow.styles';

/** The two tiles side by side, set the prototype's 28px over the list. */
export const Tiles = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 28px;
`;

/** "Needs attention" — the list's small uppercase heading, in the faint ink. */
export const ListHeading = styled.div`
  margin-bottom: 12px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The rows, stacked 10px apart. */
export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

/** The `✓ All done` card: centred, on the surface, with the soft border. */
export const AllDone = styled.div`
  padding: 40px 20px;
  text-align: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** "✓ All done" — serif, in the watched green. */
export const AllDoneHeading = styled.div`
  margin-bottom: 6px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 24px;
  color: ${({ theme }) => theme.colors.watched};
`;

/** The card's one line under the heading. */
export const AllDoneLine = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** Finish's own row, set the prototype's 28px under the card. */
export const Actions = styled.div`
  margin-top: 28px;
`;

/** A Review group's mark: its kind's 8px dot, in the Problem row's ink. */
export const KindMark = styled.span<{ $tone: DotTone }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: ${({ $tone, theme }) =>
    $tone === 'gold' ? GOLD : theme.colors[$tone]};
`;

/**
 * The **Kind filter**'s row: the track, and room at its end for the Bulk
 * actions.
 */
export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
`;

/** The track's wrapper: it scrolls sideways rather than let a pill wrap. */
export const FilterScroll = styled.div`
  display: flex;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
`;
