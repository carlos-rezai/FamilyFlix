import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CornerMenu, MenuItem } from '@/components';
import { enrichPath, movieFormPath } from '@/utils';
import { DeleteSeriesDialog } from '../DeleteSeriesDialog/DeleteSeriesDialog';

export interface SeriesEditMenuProps {
  /** The series the menu's actions apply to. */
  seriesId: string;
  /** Its title — what the Delete dialog names. */
  title: string;
  /** Every episode it holds — what the Delete dialog counts. */
  episodeCount: number;
  /** Whether any episode is a **Linked video** — what the Delete dialog tells. */
  linked?: boolean;
}

/**
 * The series page's ⋯ menu, `EditMenu`'s twin in the hero's corner. It holds
 * _✎ Edit details_, pushing `/add?series=<id>` — the **Series edit job** —
 * then _⟳ Fetch from TMDB_, pushing `/enrich?series=<id>` — the single-title
 * **Sync** — then the **Danger row**, _🗑 Delete series_, which opens the
 * Delete dialog: this menu owns the row, so it owns the dialog's open state.
 * Opening, closing and focus return are `mol.Menu`'s, and the corner and its
 * ⋯ are `CornerMenu`'s.
 */
export function SeriesEditMenu({
  seriesId,
  title,
  episodeCount,
  linked = false,
}: SeriesEditMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <CornerMenu>
        <MenuItem
          glyph="✎"
          onSelect={() => navigate(movieFormPath({ series: seriesId }))}
        >
          Edit details
        </MenuItem>
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
        linked={linked}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
