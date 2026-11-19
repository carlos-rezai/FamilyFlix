import styled, { css } from 'styled-components';

import { Button } from '@/primitives';
import { controlStates } from '@/styles/interactionStates/interactionStates';
import { Dot } from '../ProblemRow/ProblemRow.styles';

/** The two tiles side by side, set the prototype's 28px over the list. */
export const Tiles = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 28px;
`;

/** The Activity log's Accordion, set the tiles' 28px over the list. */
export const ActivityLog = styled.div`
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

/**
 * A Review group's mark: the Problem row's dot at 8px, in its ink — a span,
 * because it is drawn inside the Accordion's toggle button.
 */
export const KindMark = styled(Dot).attrs({ as: 'span' })`
  width: 8px;
  height: 8px;
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

/** The Bulk actions at the Kind filter row's end, pushed right, 4px apart. */
export const BulkActions = styled.div`
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
`;

/**
 * _Keep all mine_ and _Import all as guessed_: the filled, bordered bulk
 * button, a **Busy button** over `Button`'s own lock and label.
 */
export const BulkButton = styled(Button)`
  height: 34px;
  padding: 0 14px;
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;
  font-weight: 600;
  ${controlStates('scale(.97)')}

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background: ${({ theme }) => theme.colors.border};
    border-color: ${({ theme }) => theme.colors.border};
  }
`;

/** _Skip all_'s face: the faint text button. */
const skipAllFace = css`
  padding: 0 14px;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textFaint};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  ${controlStates('scale(.97)')}

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background: transparent;
    color: ${({ theme }) => theme.colors.textDim};
  }
`;

/**
 * _Skip all_ beside the Kind filter: 34px, a **Busy button** over `Button`'s
 * own lock and label.
 */
export const BulkSkipAllButton = styled(Button)`
  height: 34px;
  ${skipAllFace}
`;

/** _Skip all_ among a Review group's Accordion actions: 40px. */
export const SkipAllButton = styled.button`
  height: 40px;
  ${skipAllFace}
`;
