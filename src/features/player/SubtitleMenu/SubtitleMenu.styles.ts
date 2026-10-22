import styled from 'styled-components';

import { Menu } from '@/components';

/**
 * The slot, and what the Subtitle picker changes about `Menu`'s panel: the
 * Audio picker's upward panel, over the bottom bar, as wide as
 * `feat.PlayerControls.dc.html` draws it. Reached by its role rather than by
 * `Menu`'s own styled panel, which the category barrel does not export.
 */
export const Root = styled(Menu)`
  [role='menu'] {
    top: auto;
    bottom: 54px;
    min-width: 220px;
    z-index: 50;
  }
`;
