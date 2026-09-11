import styled from 'styled-components';

import { Menu } from '../Menu/Menu';
import { Item, Panel } from '../Menu/Menu.styles';

/**
 * The row itself, from `mol.SubtitleRow.dc.html` — the same soft box
 * `FileField` draws a filled slot in, because a track *is* a filled slot with a
 * language on it. That box, its glyph and its filename are the molecule rung's
 * furniture (`fileRow.styles.ts`); what is this row's own is the language
 * control, which follows.
 */
export { Row, IconSlot, Filename } from '../fileRow.styles';

/**
 * The slot the language list hangs in, and what this row changes about
 * `Menu`'s panel — its geometry and its face. `mol.SubtitleRow.dc.html` draws
 * the list smaller than a filter list in every dimension: it drops from a
 * control shorter than a filter pill, opens narrower, and wears an 8px corner,
 * 5px of padding and a lighter shadow around 13px items on `8px 12px` with a
 * 6px corner. `Menu` was built from the filter dropdown's prototype, so every
 * one of those is overridden here rather than inherited.
 *
 * A component selector rather than props on `Menu`, on `FilterDropdown`'s own
 * precedent — how the list looks under this control is the caller's concern,
 * and threading it through the shared menu would put props on it that only one
 * client could set. The `6px` item corner is the prototype's own and not a
 * radius token, so it is written literally.
 */
export const LanguageMenu = styled(Menu)`
  flex: 0 0 auto;

  ${Panel} {
    top: 40px;
    min-width: 150px;
    max-height: 220px;
    padding: 5px;
    border-radius: ${({ theme }) => theme.radius.sm};
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
  }

  ${Item} {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
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
