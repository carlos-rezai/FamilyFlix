import styled from 'styled-components';

/**
 * The whole row one bare button, at the 4px inset both prototypes share; its
 * vertical padding is the caller's.
 */
export const Row = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 0 4px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
`;

/** The glyph in its accent tile — the prototype's own 38px and 9px. */
export const Tile = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

/** The label and its line, taking the width the tile and chevron do not. */
export const Text = styled.span`
  flex: 1;
  min-width: 0;
`;

export const Label = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

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
