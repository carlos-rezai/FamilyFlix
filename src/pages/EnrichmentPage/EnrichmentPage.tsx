import { EnrichmentFlow } from '@/features/enrichment/EnrichmentFlow/EnrichmentFlow';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/enrich` — composition only: the **Enrichment flow** in the **Maintainer
 * surface**, at the 880 measure `feat.EnrichmentFlow.dc.html` draws its
 * column at.
 */
export default function EnrichmentPage() {
  return (
    <MaintainerLayout width={880}>
      <EnrichmentFlow />
    </MaintainerLayout>
  );
}
