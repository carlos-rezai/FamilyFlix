import styled from 'styled-components';

/**
 * The Files card — the panel the prototype draws under the metadata fields, on
 * the surface colour rather than the sheet's, so the slots read as one group
 * separate from the boxes above them.
 */
export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: ${({ theme }) => theme.space.s5};
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

/**
 * "＋ Add subtitle file" — the dashed box `FileField` draws an empty slot as,
 * and a `<label>` for the same reason: a click has to open a file dialog, and
 * only a real `<input type="file">` can.
 *
 * Unlike a slot's, it stays after a file is picked. This is a list, and the ＋
 * is how it grows.
 */
export const AddTrack = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  background: transparent;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.text};
  }
`;

/**
 * The input itself: present to every screen reader and every file dialog, and
 * invisible to everyone else — clipped rather than `display: none`, which would
 * take it out of the accessibility tree along with the label naming it.
 */
export const TrackPicker = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
