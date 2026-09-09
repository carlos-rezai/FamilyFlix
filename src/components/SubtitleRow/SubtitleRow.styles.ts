import styled from 'styled-components';

import { Menu } from '../Menu/Menu';
import { Panel } from '../Menu/Menu.styles';

/**
 * The row itself, from `mol.SubtitleRow.dc.html` — the same soft box
 * `FileField` draws a filled slot in, because a track *is* a filled slot with a
 * language on it.
 */
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
 * The filename, in the mono face — and the ellipsis that keeps a 90-character
 * release name from pushing the language control off the row.
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
 * The slot the language list hangs in, and the only thing this row changes
 * about `Menu`'s panel: where it drops from, and how wide it opens under a
 * control that is shorter than a filter pill.
 *
 * A component selector rather than props on `Menu`, on `FilterDropdown`'s own
 * precedent — the panel's geometry is the caller's layout concern, and
 * threading it through the shared menu would put a prop on it that only one
 * client could set.
 */
export const LanguageMenu = styled(Menu)`
  flex: 0 0 auto;

  ${Panel} {
    top: 40px;
    min-width: 150px;
    max-height: 220px;
  }
`;

/** The language control: the current language, and the caret that opens the list. */
export const Language = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 34px;
  min-width: 118px;
  padding: 0 10px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 7px;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The caret. Decorative, so it stays out of the control's name. */
export const Chevron = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 11px;
`;

/**
 * The ✕. A literal glyph rather than an icon atom, on `MenuItem`'s precedent
 * and `FileField`'s — and it turns the danger colour on hover, because taking a
 * track off the movie is the one destructive thing this row does.
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
