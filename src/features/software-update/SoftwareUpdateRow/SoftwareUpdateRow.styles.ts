import styled, { type DefaultTheme } from 'styled-components';

import type { UpdateTone } from '../updateFace/updateFace';

/**
 * The About card's first row, from `page.SettingsPage.dc.html`: the tile, the
 * two lines and the button, inset at the prototype's `18px 20px` — the card
 * itself carries no padding.
 */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
`;

/** The UploadIcon in its 42px tile; `10px` is the prototype's own corner. */
export const Tile = styled.div`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The title and the line, taking the width the tile and button do not. */
export const Text = styled.div`
  flex: 1;
  min-width: 0;
`;

/** _Software update_, 16px semibold in the text ink. */
export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const toneInk = (theme: DefaultTheme, tone: UpdateTone): string =>
  ({
    offer: theme.colors.accent,
    dim: theme.colors.textDim,
    faint: theme.colors.textFaint,
  })[tone];

/** The face's line, 13px, in its tone's ink. */
export const Line = styled.div<{ $tone: UpdateTone }>`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme, $tone }) => toneInk(theme, $tone)};
`;

/** The button's slot, never shrinking. */
export const Action = styled.div`
  flex: 0 0 auto;
`;

/**
 * The full-bleed hairline under the row — local to this card, not
 * `section.styles`' 22px-margin `Divider`.
 */
export const Hairline = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSoft};
`;
