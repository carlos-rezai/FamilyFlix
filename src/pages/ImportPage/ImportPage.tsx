import { ImportFlow } from '@/features/import-export/ImportFlow/ImportFlow';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/import` — composition only: the **Import flow** in the **Maintainer
 * surface**, at the one **Page measure** every column screen shares.
 */
export default function ImportPage() {
  return (
    <MaintainerLayout>
      <ImportFlow />
    </MaintainerLayout>
  );
}
