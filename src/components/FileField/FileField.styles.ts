import styled from 'styled-components';

/** The slot: its name on the left, its one control filling the rest. */
export const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s3};
`;

/**
 * The slot's name — a fixed 70px measure, so the controls of a column of these
 * line up with each other rather than with their own captions.
 */
export const Label = styled.span`
  flex: 0 0 70px;
  padding-top: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** Whichever of the two controls the slot is showing. */
export const Control = styled.div`
  flex: 1;
  min-width: 0;
`;

/**
 * The empty state: a dashed box that reads as a button and says what it wants.
 *
 * It is a `<label>` rather than a `<button>`, and that is the whole design of
 * this molecule. A click has to open a file dialog, and only a real
 * `<input type="file">` can — so the control the maintainer presses *is* the
 * input's label, and the input itself is hidden behind it.
 */
export const Choose = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
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
 * invisible to everyone else.
 *
 * Hidden by clipping rather than by `display: none`, which would take it out of
 * the accessibility tree along with the label naming it — and out of reach of a
 * keyboard, which is the one way this control is operated without a mouse.
 */
export const Picker = styled.input`
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

/** The filled state: the file that is in the slot, on the prototype's soft box. */
export const Filled = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

/** The glyph the caller handed in, dimmed beside the name. */
export const IconSlot = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The filename, in the mono face — a filename is a filename, and the ellipsis
 * is what keeps a 90-character release name from pushing the ✕ off the row.
 */
export const Filename = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/**
 * The ✕. A literal glyph rather than an icon atom, on `MenuItem`'s precedent —
 * and it turns the danger colour on hover, because emptying a slot is the one
 * destructive thing this row does.
 */
export const Remove = styled.button`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: ${({ theme }) => theme.colors.textFaint};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
    background: rgba(201, 122, 106, 0.1);
  }
`;
