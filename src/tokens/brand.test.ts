// @vitest-environment node
//
// 55, Intro animation, Phase 1 (issue #503): the brand tokens.
// The mark's two F paths and its viewBox, lifted out of `LogoLoader` into
// `src/tokens/brand.ts` so the **Logo loader** and the **Welcome splash** draw
// the same Fs. They are the paths of `docs/handoff/brand/familyflix-mark.svg`,
// exported from the tokens barrel, and no other shipping file under `src/`
// spells them: `LogoLoader` reads them back, and its docblock says so.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MARK_F1, MARK_F2, MARK_VIEWBOX } from '@/tokens';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';

/** A file of the repo, read from here. */
function repoFile(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    'utf8'
  );
}

/** The `d` of each path in the brand mark: the two Fs. */
function markPaths(): string[] {
  const svg = repoFile('docs/handoff/brand/familyflix-mark.svg');
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
}

/** Every `/** ... *\/` docblock in a source, joined. */
function docblocks(source: string): string {
  return [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)]
    .map((match) => match[0])
    .join('\n');
}

/** The mark spelled out: either F's first point, or its viewBox. */
const MARK_LITERAL = /M380\.23 704\.39|M736\.30 704\.39|160 300 704 424/;

describe('the brand tokens', () => {
  it("are the brand mark's two F paths, through the tokens barrel", () => {
    expect([MARK_F1, MARK_F2]).toEqual(markPaths());
  });

  it("frame the two Fs in the mark's viewBox", () => {
    expect(MARK_VIEWBOX).toBe('160 300 704 424');
  });
});

describe('the brand tokens: the one place the mark is spelled', () => {
  it('lets no shipping file under src/ but brand.ts spell an F or the viewBox', () => {
    expect(shippingSourcesMatching('src', MARK_LITERAL)).toEqual([
      'src/tokens/brand.ts',
    ]);
  });

  it("names brand.ts in LogoLoader's docblock as where its Fs come from", () => {
    const source = repoFile('src/primitives/LogoLoader/LogoLoader.tsx');

    expect(docblocks(source)).toMatch(/brand\.ts/);
  });
});
