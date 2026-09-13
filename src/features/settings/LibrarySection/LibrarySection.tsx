import { useNavigate } from 'react-router-dom';

import { ActionRow } from '../ActionRow/ActionRow';
import { GroupHeading, Rows } from './LibrarySection.styles';

/**
 * The Settings hub's **Library section**, from `page.SettingsPage.dc.html`:
 * the `Library` group heading over the `＋ Add a movie` and `⇪ Import from
 * spreadsheet` rows. Exactly two — the prototype draws a third, `⬇ Export to
 * CSV`, and a row whose destination does not exist is not drawn. Export is
 * its own initiative.
 *
 * Like `SettingsHeader`, the section owns where its rows lead: the maintainer
 * surface's only doors are here, and a page is composition only. Playback,
 * Storage and About are the settings-shell initiative's.
 */
export function LibrarySection() {
  const navigate = useNavigate();

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
      </Rows>
    </>
  );
}
