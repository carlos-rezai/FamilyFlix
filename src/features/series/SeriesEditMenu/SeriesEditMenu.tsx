import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MenuItem } from '@/components';
import { MoreIcon } from '@/primitives';
import { enrichPath } from '@/utils';
import { DeleteSeriesDialog } from '../DeleteSeriesDialog/DeleteSeriesDialog';
import { CornerMenu, MoreButton } from './SeriesEditMenu.styles';

export interface SeriesEditMenuProps {
  /** The series the menu's actions apply to. */
  seriesId: string;
  /** Its title — what the Delete dialog names. */
  title: string;
  /** Every episode it holds — what the Delete dialog counts. */
  episodeCount: number;
}

/** The ⋯ trigger's square, matching the Back circle's height. */
const MORE_SIZE = 44;

/**
 * The series page's ⋯ menu, `EditMenu`'s twin in the hero's corner. It holds
 * _⟳ Fetch from TMDB_, pushing `/enrich?series=<id>` — the single-title
 * **Sync** — then the **Danger row**, _🗑 Delete series_, which opens the
 * Delete dialog:
 * this menu owns the row, so it owns the dialog's open state. Opening, closing
 * and focus return are `mol.Menu`'s.
 */
export function SeriesEditMenu({
  seriesId,
  title,
  episodeCount,
}: SeriesEditMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <CornerMenu
        trigger={(props) => (
          <MoreButton {...props} label="More options" size={MORE_SIZE}>
            <MoreIcon size={20} />
          </MoreButton>
        )}
      >
        <MenuItem
          glyph="⟳"
          onSelect={() => navigate(enrichPath({ series: seriesId }))}
        >
          Fetch from TMDB
        </MenuItem>
        <MenuItem glyph="🗑" danger onSelect={() => setDeleteOpen(true)}>
          Delete series
        </MenuItem>
      </CornerMenu>
      <DeleteSeriesDialog
        seriesId={seriesId}
        title={title}
        episodeCount={episodeCount}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
