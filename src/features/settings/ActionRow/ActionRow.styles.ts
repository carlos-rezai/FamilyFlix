import styled from 'styled-components';

/**
 * The whole row, one button, from `page.SettingsPage.dc.html`'s Library
 * group: the glyph tile, the two lines and the chevron on the surface fill,
 * lifting to the second surface with the accent line on hover.
 */
export const Row = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 15px 16px;
  text-align: left;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surface2};
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/**
 * The glyph in its accent tile. `9px` is the prototype's own corner and is not
 * a radius token; the `38px` square is its own too.
 */
export const GlyphTile = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
  font-size: 18px;
  font-weight: 700;
`;

/** The label and the line under it, taking the width the tile and chevron do not. */
export const Text = styled.span`
  flex: 1;
  min-width: 0;
`;

/** The row's name. */
export const Label = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** What the row leads to, said once under its name. */
export const Desc = styled.span`
  display: block;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The chevron at the row's end, in the faintest ink. */
export const Chevron = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;
