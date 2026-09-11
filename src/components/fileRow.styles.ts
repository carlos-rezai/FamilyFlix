import styled from 'styled-components';

/**
 * The row a file is drawn in once it is in the form: a soft box on the deeper
 * background, a dimmed glyph, and the file's name in the mono face with an
 * ellipsis. `mol.FileField.dc.html` draws a filled **File slot** in it and
 * `mol.SubtitleRow.dc.html` draws a **Subtitle row** in it, because a track
 * *is* a filled slot with a language on it.
 *
 * This is the molecule rung's furniture rather than either molecule's, on
 * `layouts/chrome.styles.ts`'s precedent: the three blocks were written twice,
 * character for character, and a third `IconSlot` sits in `TextField.styles.ts`
 * — which stays there, because a primitive does not import from the rung
 * above it. Each molecule extends these and states only what is genuinely its
 * own. Deliberately not `SubtitleRow` importing from `FileField.styles`: that
 * would make one molecule's styles another molecule's public surface. Both
 * import the furniture; neither owns it.
 */

/** The soft box, from the prototype: `7px 10px` on an 8px corner. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

/** The file glyph, dimmed beside the name. Decorative, and hidden as such. */
export const IconSlot = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The filename, in the mono face — a filename is a filename — and the ellipsis
 * that keeps a 90-character release name from pushing the controls after it
 * off the row.
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
