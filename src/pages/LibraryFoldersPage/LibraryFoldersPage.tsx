import { LibraryFolders } from '@/features/import-export/LibraryFolders/LibraryFolders';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings/folders` — composition only: the **Library folders** organism in
 * the **Maintainer surface**, at the Settings hub's own 780 column.
 */
export default function LibraryFoldersPage() {
  return (
    <MaintainerLayout width={780}>
      <LibraryFolders />
    </MaintainerLayout>
  );
}
