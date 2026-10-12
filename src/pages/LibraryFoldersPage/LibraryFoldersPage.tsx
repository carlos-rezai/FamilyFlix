import { LibraryFolders } from '@/features/import-export/LibraryFolders/LibraryFolders';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings/folders` — composition only: the **Library folders** organism in
 * the **Maintainer surface**, at the one **Page measure**.
 */
export default function LibraryFoldersPage() {
  return (
    <MaintainerLayout>
      <LibraryFolders />
    </MaintainerLayout>
  );
}
