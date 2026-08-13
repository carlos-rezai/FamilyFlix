import { useNavigate } from 'react-router-dom';

import { MenuItem } from '@/components';
import { MoreIcon } from '@/primitives';
import { CornerMenu, MoreButton } from './EditMenu.styles';

export interface EditMenuProps {
  /** The movie the menu's actions apply to. */
  movieId: string;
}

/** The ⋯ trigger's square, matching the Back pill's height across the screen. */
const MORE_SIZE = 44;

/**
 * The movie detail page's ⋯ overflow menu, in its fixed slot opposite the Back
 * pill.
 *
 * It ships with one item. Delete is not designed anywhere in the handoff — no
 * confirmation exists — so it lands with its own feature rather than as a red
 * row that closes the menu and does nothing, or a permanently greyed one that
 * reads as "this movie can't be deleted".
 *
 * Edit navigates to `/add?movie=<id>`, the prototype's own route for editing (it
 * pre-fills the add form rather than owning an `/edit` screen). The query
 * parameter is **provisional** — the movie-form grill owns the real contract.
 *
 * Everything about opening and closing belongs to `mol.Menu`. What is left here
 * is the whole of what makes this menu *this* menu: a translucent ⋯ button, and
 * one item that knows which movie it is editing.
 */
export function EditMenu({ movieId }: EditMenuProps) {
  const navigate = useNavigate();

  return (
    <CornerMenu
      trigger={(props) => (
        <MoreButton {...props} label="More options" size={MORE_SIZE}>
          <MoreIcon size={20} />
        </MoreButton>
      )}
    >
      <MenuItem glyph="✎" onSelect={() => navigate(`/add?movie=${movieId}`)}>
        Edit details
      </MenuItem>
    </CornerMenu>
  );
}
