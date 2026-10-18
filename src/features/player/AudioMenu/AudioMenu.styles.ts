import styled from 'styled-components';

import { Menu } from '@/components';

/**
 * The slot, and what the Audio picker changes about `Menu`'s panel: it opens
 * upward, over the bottom bar — there is no screen left under the transport
 * row — and as wide as `feat.PlayerControls.dc.html` draws it. Reached by its
 * role rather than by `Menu`'s own styled panel, which the category barrel
 * does not export.
 */
export const Root = styled(Menu)`
  [role='menu'] {
    top: auto;
    bottom: 54px;
    min-width: 220px;
    z-index: 50;
  }
`;
