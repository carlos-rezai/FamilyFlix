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

/** _Where it is saved_'s card: its two rows on the surface. */
export const Targets = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/** The hairline between the card's two rows. */
export const TargetDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSoft};
`;

/** One row of the card: the glyph tile, the two lines, the trailing badge. */
export const SavedRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
`;

/** The row's 38px glyph tile. */
export const SavedGlyph = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.surface3};
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The title and the line, taking the width the tile and badge do not. */
export const SavedText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SavedTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** A plain line under the title: _Your library_'s. */
export const SavedLine = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Your library folders_' path under its title, in mono, clipped to one line. */
export const SavedPath = styled.div`
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** _Required_ or _Always_ at the row's end. */
export const SavedBadge = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 4px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The note under the card, always drawn. */
export const SourceNote = styled.div`
  margin: 10px 0 0 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textFaint};
  text-wrap: pretty;
`;

/**
 * The note the **let-go line** is drawn in under Start, `SourceNote`'s
 * sibling in its style: 10px below the row, as the source note sits under
 * its card, the Stack's gap taken back.
 */
export const LetGoNote = styled(SourceNote)`
  margin-top: -10px;
`;

export const SourceNoteMono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.textDim};
`;
