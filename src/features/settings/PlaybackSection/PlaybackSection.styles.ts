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
