import styled from 'styled-components';

import { NavigationRow } from '../NavigationRow/NavigationRow';

/**
 * The **Codecs row**, placed: `page.SettingsPage.dc.html` draws it at
 * `4px 4px 0`, first in its card, so the card's own 20px is all it needs
 * above it.
 */
export const CodecsRow = styled(NavigationRow)`
  padding: 4px 4px 0;
`;

/** The Subtitles half's own header: title and lede, 14px over the first row. */
export const SubtitlesHeader = styled.div`
  margin-bottom: 14px;
`;

/** A row's title beside whatever pill it wears. */
export const RowTitleLine = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

/** The **Coming soon** pill: small caps in the faint ink on the third surface. */
export const ComingSoon = styled.span`
  padding: 2px 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The hairline between two rows — the card's divider on a row's 6px. */
export const RowRule = styled.div`
  height: 1px;
  margin: 6px 0;
  background: ${({ theme }) => theme.colors.borderSoft};
`;
