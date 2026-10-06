import { CodecManager } from '@/features/settings/CodecManager/CodecManager';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings/codecs` — composition only: the **Codec manager** in the
 * **Maintainer surface**, at the Settings hub's own 780 column, the measure
 * `page.CodecsPage.dc.html` draws its sheet at.
 */
export default function CodecsPage() {
  return (
    <MaintainerLayout width={780}>
      <CodecManager />
    </MaintainerLayout>
  );
}
