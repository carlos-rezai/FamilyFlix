import styled from 'styled-components';

/** A section's heading — _Format_, _Columns included_: 13px semibold in the dim ink. */
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
 * The filename row: the sheet glyph and the name at one end, the count at the
 * other, on `bg2` inside the soft border.
 */
export const FileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The glyph and the filename, 10px apart; the faint ink is the glyph's. */
export const FileName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The **Export file**'s name, in mono, in the dim ink. */
export const Filename = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The **Export summary**'s count, semibold in the accent. */
export const Count = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;

/** The eight **Column pills**, wrapping, as a list drawn without its bullets. */
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

/** The line under it: 15px in the dim ink, the filename in mono inside it. */
export const DoneLine = styled.p`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
  margin: 8px 0 0;
`;

/** The filename inside the done line, in mono and the text ink. */
export const DoneFilename = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
`;

/** _Done_, 26px under the line. */
export const DoneActions = styled.div`
  margin-top: 26px;
`;
