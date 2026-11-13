import { FilterDropdown } from '@/components';

import { rowViewLabel, rowViewOptions } from '../rowViewOptions/rowViewOptions';
import { useRowView } from '../useRowView/useRowView';

/**
 * The **Row view switch** (`page.LibraryPage.dc.html`): the _View_ pill after
 * Sort, showing the current **Library tab**'s **Row view**. A choice sets that
 * tab's view alone, with no snackbar, and writes no URL. Nothing is drawn
 * until the household's settings read lands.
 */
export function RowViewSwitch() {
  const { rowView, setRowView } = useRowView();

  if (rowView === null) {
    return null;
  }

  return (
    <FilterDropdown
      label="View"
      value={rowViewLabel(rowView)}
      options={rowViewOptions(rowView, (view) => {
        void setRowView(view);
      })}
      menuWidth={180}
    />
  );
}
