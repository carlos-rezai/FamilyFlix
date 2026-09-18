import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ExportModal } from '@/features/import-export/ExportModal/ExportModal';
import { ActionRow } from '../ActionRow/ActionRow';
import { GroupHeading } from '../section.styles';
import { Rows } from './LibrarySection.styles';

/**
 * The Settings hub's **Library section**, from `page.SettingsPage.dc.html`:
 * the `Library` group heading over the `＋ Add a movie`, `⇪ Import from
 * spreadsheet` and `⬇ Export to CSV` rows — the third's label kept as drawn,
 * though the dialog it opens offers Excel too.
 *
 * Like `SettingsHeader`, the section owns where its rows lead: the maintainer
 * surface's only doors are here, and a page is composition only. The first
 * two are routes; the third is an overlay — the section holds whether the
 * **Export dialog** is open and mounts it beside its rows, so closing it
 * leaves the page where it was, scroll and all, with focus back on the row.
 * The app's first import of one feature's organism by another: a section
 * composing a dialog is fine; a feature importing another's hook or wire
 * would not be. The **Group heading** is the feature's shared furniture in
 * `section.styles.ts`, so the four groups' headings are one styled component;
 * this one draws rows under it where Playback, Storage and About draw a
 * **Section card**.
 */
export function LibrarySection() {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <GroupHeading>Library</GroupHeading>
      <Rows>
        <ActionRow
          glyph="＋"
          label="Add a movie"
          desc="Pick the video, poster, and subtitle files for one title."
          onClick={() => navigate('/add')}
        />
        <ActionRow
          glyph="⇪"
          label="Import from spreadsheet"
          desc="Bulk-migrate a spreadsheet + movie folders in one pass."
          onClick={() => navigate('/import')}
        />
        <ActionRow
          glyph="⬇"
          label="Export to CSV"
          desc="Save your whole library out as a spreadsheet backup."
          onClick={() => setExportOpen(true)}
        />
      </Rows>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
