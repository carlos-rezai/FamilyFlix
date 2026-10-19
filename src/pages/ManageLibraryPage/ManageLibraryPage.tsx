import { ManageLibrary } from '@/features/manage-library/ManageLibrary/ManageLibrary';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings/library` — composition only: the **Manage library page**'s
 * organism in the **Maintainer surface**, at the one **Page measure**.
 */
export default function ManageLibraryPage() {
  return (
    <MaintainerLayout>
      <ManageLibrary />
    </MaintainerLayout>
  );
}
