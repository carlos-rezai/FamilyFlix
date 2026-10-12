import { CodecManager } from '@/features/settings/CodecManager/CodecManager';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings/codecs` — composition only: the **Codec manager** in the
 * **Maintainer surface**, at the one **Page measure**.
 */
export default function CodecsPage() {
  return (
    <MaintainerLayout>
      <CodecManager />
    </MaintainerLayout>
  );
}
