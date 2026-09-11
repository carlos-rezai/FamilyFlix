import styled from 'styled-components';

/**
 * The Files card — the panel the prototype draws under the metadata fields, on
 * the surface colour rather than the sheet's, so the slots read as one group
 * separate from the boxes above them.
 *
 * `20px` is the prototype's own padding and is not a step on the spacing
 * scale, so it is written literally — the same rule `MovieForm.styles.ts`
 * states for its `22px` field gap: the values a screen shares with the scale
 * are written as tokens, and the ones it does not are written as the prototype
 * writes them.
 */
export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The card's caption — small, spaced and uppercase, as the prototype sets it. */
export const Caption = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The subtitles section: its name on the left, its rows and its ＋ filling the
 * rest — `FileField`'s own arrangement at the one slot that is a list rather
 * than a slot, so the three controls of the card line up with each other.
 */
export const Subtitles = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s3};
`;

/** The section's name, on the same fixed 70px measure the two slots above use. */
export const SubtitlesLabel = styled.span`
  flex: 0 0 70px;
  padding-top: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The attached rows, and the ＋ under them. */
export const Tracks = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
`;
