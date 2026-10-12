import type { ReactNode } from 'react';

import { MoreIcon } from '@/primitives';
import { Corner, MoreButton } from './CornerMenu.styles';

export interface CornerMenuProps {
  /** The menu's rows — `MenuItem`s, each of which shuts the menu when used. */
  children: ReactNode;
}

/** The ⋯ trigger's square, matching the Back pill's height across the screen. */
const MORE_SIZE = 44;

/**
 * The ⋯ overflow menu's furniture, drawn by both detail pages: `mol.Menu` in
 * the fixed top-right slot opposite the Back pill, opened by a translucent 44px
 * ⋯ named _More options_. Presentational — it knows no route and no dialog;
 * the rows it is handed are what make a menu the movie's or the series'.
 */
export function CornerMenu({ children }: CornerMenuProps) {
  return (
    <Corner
      trigger={(props) => (
        <MoreButton {...props} label="More options" size={MORE_SIZE}>
          <MoreIcon size={20} />
        </MoreButton>
      )}
    >
      {children}
    </Corner>
  );
}
