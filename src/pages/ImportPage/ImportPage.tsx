import { ImportFlow } from '@/features/import-export/ImportFlow/ImportFlow';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/import` — composition only: the **Import flow** in the **Maintainer
 * surface**, at the 760 measure `feat.ImportFlow.dc.html` draws its column at
 * — 760, not Settings' 780: the two prototypes draw their columns a measure
 * apart, and until they are amended to one sheet each screen states its own.
 */
export default function ImportPage() {
  return (
    <MaintainerLayout width={760}>
      <ImportFlow />
    </MaintainerLayout>
  );
}
