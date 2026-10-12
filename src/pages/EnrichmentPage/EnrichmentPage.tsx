import { EnrichmentFlow } from '@/features/enrichment/EnrichmentFlow/EnrichmentFlow';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/enrich` — composition only: the **Enrichment flow** in the **Maintainer
 * surface**, at the one **Page measure**.
 */
export default function EnrichmentPage() {
  return (
    <MaintainerLayout>
      <EnrichmentFlow />
    </MaintainerLayout>
  );
}
