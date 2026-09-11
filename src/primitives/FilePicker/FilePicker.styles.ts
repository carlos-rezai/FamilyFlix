import styled from 'styled-components';

/**
 * The dashed box that reads as a button and says what it wants — the empty
 * state of `mol.FileField.dc.html`, and the ＋ under the subtitle rows in
 * `feat.MovieForm.dc.html`, which are the same 42px box.
 *
 * It is a `<label>` rather than a `<button>`, and that is the whole design of
 * this atom. A click has to open a file dialog, and only a real
 * `<input type="file">` can — so the control the maintainer presses *is* the
 * input's label, and the input itself is hidden behind it.
 */
export const Box = styled.label`
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
export const Input = styled.input`
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
