import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MenuItem } from '@/components';
import { MoreIcon } from '@/primitives';
import { DeleteMovieDialog } from '../DeleteMovieDialog/DeleteMovieDialog';
import { CornerMenu, MoreButton } from './EditMenu.styles';

export interface EditMenuProps {
  /** The movie the menu's actions apply to. */
  movieId: string;
  /** Its title — what the Delete dialog names. */
  title: string;
}

/** The ⋯ trigger's square, matching the Back pill's height across the screen. */
const MORE_SIZE = 44;

/**
 * The movie detail page's ⋯ overflow menu, in its fixed slot opposite the Back
 * pill.
 *
 * Two rows. Edit navigates to `/add?movie=<id>`, the prototype's own route for
 * editing (it pre-fills the add form rather than owning an `/edit` screen).
 * Delete is the **Danger row**, and it opens the **Delete dialog** rather than
 * deleting: this menu owns the row, so it owns the dialog's open state too, and
 * renders the dialog beside the corner slot — the portal takes it out of the
 * fixed corner and over the whole viewport.
 *
 * Everything about opening and closing the menu belongs to `mol.Menu`. What is
 * left here is the whole of what makes this menu *this* menu: a translucent ⋯
 * button, and two rows that know which movie they are for.
 */
export function EditMenu({ movieId, title }: EditMenuProps) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
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
        <MenuItem glyph="🗑" danger onSelect={() => setDeleteOpen(true)}>
          Delete movie
        </MenuItem>
      </CornerMenu>
      <DeleteMovieDialog
        movieId={movieId}
        title={title}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
