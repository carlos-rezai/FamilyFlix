import styled from 'styled-components';

/** _Save to_'s row and a refused field's line: the path furniture. */
export { PathRow, Refusal } from '../pathField.styles';

/**
 * A section's heading — _Format_, _Save to_, _Folder name_, _Include_,
 * _Columns included_: 13px semibold in the dim ink.
 */
export const SectionLabel = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 8px;
`;

/** The two **Format cards**, side by side. */
export const Formats = styled.div`
  display: flex;
  gap: 10px;
`;

/**
 * The _Folder name_ label row: the heading at one end, the count at the
 * other, 8px over the field — the heading's own margin is the row's.
 */
export const LabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  & > ${SectionLabel} {
    margin-bottom: 0;
  }
`;

/** The **Export summary**'s count, semibold in the accent. */
export const Count = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;

/**
 * The sixteen **Column pills**, wrapping, as a list drawn without its
 * bullets.
 */
export const Columns = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  list-style: none;
  margin: 0;
  padding: 0;
`;

/** One **Column pill**: 12.5px in the dim ink, on the surface inside the border. */
export const ColumnPill = styled.li`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textDim};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 5px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The two buttons, export first. */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
`;

/** The **Export ready** face: centred, 44px 32px inside the bare card. */
export const Done = styled.div`
  padding: 44px 32px;
  text-align: center;
`;

/** The 64px watched-tinted circle the tick sits in, the tick in the watched ink. */
export const TickCircle = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 18px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(138, 154, 107, 0.16);
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.watched};
`;

/** _Export ready_ — the Modal's own heading, drawn by this face since the card is bare. */
export const DoneHeading = styled.h2`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

/**
 * The line under it: 15px in the dim ink, the folder and where in mono
 * inside it.
 */
export const DoneLine = styled.p`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
  margin: 8px 0 0;
`;

/**
 * A path inside the done line — the folder written, then its destination —
 * in mono and the text ink.
 */
export const DonePath = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
`;

/** _Done_, 26px under the line. */
export const DoneActions = styled.div`
  margin-top: 26px;
`;

/**
 * The **Include** group's card: the surface inside the border, its rows
 * stacked.
 */
export const IncludeCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** One Include row: its words at one end, its Toggle at the other. */
export const IncludeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
`;

/** The row's words, taking what the Toggle leaves. */
export const IncludeText = styled.div`
  flex: 1;
  min-width: 0;
`;

/** An Include row's title, 14.5px semibold in the text ink. */
export const IncludeTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The line under an Include row's title, 12.5px in the faint ink. */
export const IncludeDesc = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The 1px rule between two Include rows, in the soft border. */
export const IncludeDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSoft};
`;
