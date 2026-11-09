// @vitest-environment node
//
// 58, Folder layout, Phase 10 (issue #543): no Write target options.
//
// `POST /api/enrichment` takes no **Write target** options: a body without
// `writeSheet` and `writePosters` is a Sync, and one still sending them reads
// to the options without them.

import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS } from '@/types';
import { startEnrichmentBody } from './enrichmentBody';

const LIBRARY = { scope: 'all', fields: [...ENRICH_FIELDS] } as const;

describe('startEnrichmentBody: no Write target options', () => {
  it('reads a library Sync that names no Write targets', () => {
    expect(startEnrichmentBody(LIBRARY)).toEqual({
      ok: true,
      value: { scope: 'all', fields: [...ENRICH_FIELDS] },
    });
  });

  it('drops the retired switches from a body still sending them', () => {
    const body = { ...LIBRARY, writeSheet: true, writePosters: false };

    expect(startEnrichmentBody(body)).toEqual({
      ok: true,
      value: { scope: 'all', fields: [...ENRICH_FIELDS] },
    });
  });
});
