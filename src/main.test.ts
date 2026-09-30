// @vitest-environment node
//
// Issue #221 — the library looks the same with the network cable out. The
// renderer's three families come from `@fontsource`, imported once at the
// entry, rather than from Google Fonts; the CSP's `font-src 'self'` would
// refuse the CDN anyway, and the family's machine may be offline. The page's
// `<title>` reads FamilyFlix.
//
// The smoke check — network off, the wordmark in Source Serif rather than
// Georgia — needs a real Chromium and is run by hand. What this suite pins is
// everything that smoke depends on: every face the wordmark and the rest of
// the app ask for is declared locally, and none of them points off the origin.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  shippingSourcesMatching,
  withoutComments,
} from './test-support/shippingSources/shippingSources';
import { typography } from './tokens/typography';

const ENTRY = fileURLToPath(new URL('./main.tsx', import.meta.url));
const INDEX_HTML = fileURLToPath(new URL('../index.html', import.meta.url));
const SRC = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');

/** A typography token's first family — the face it asks for before any fallback. */
function familyOf(token: string): string {
  const match = /^'([^']+)'/.exec(token);
  if (!match) throw new Error(`no quoted family in ${token}`);
  return match[1];
}

/** `@fontsource`'s package name for a family: lower-cased, spaces to dashes. */
function slugOf(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-');
}

/**
 * The weights each token is drawn at — the set the Google Fonts link loaded
 * before this issue, and so the set the app's `font-weight`s were written
 * against.
 */
const WEIGHTS: Record<keyof typeof typography, number[]> = {
  serif: [400, 500, 600, 700],
  sans: [400, 500, 600, 700],
  mono: [400, 500],
};

const FACES = (Object.keys(WEIGHTS) as (keyof typeof typography)[]).flatMap(
  (token) =>
    WEIGHTS[token].map((weight) => {
      const family = familyOf(typography[token]);
      return {
        token,
        family,
        weight,
        specifier: `@fontsource/${slugOf(family)}/${weight}.css`,
      };
    })
);

/** Every module specifier a source imports for its side effect or its bindings. */
function importsOf(source: string): string[] {
  return [
    ...withoutComments(source).matchAll(
      /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
    ),
  ].map((match) => match[1]);
}

describe('index.html', () => {
  const html = readFileSync(INDEX_HTML, 'utf8');

  it('asks no font CDN for anything: no Google Fonts link and no preconnect', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(html).not.toMatch(/rel=["']preconnect["']/);
  });

  it('links nothing off the origin', () => {
    const hrefs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(
      (match) => match[1]
    );

    expect(hrefs.filter((href) => /^(https?:)?\/\//.test(href))).toEqual([]);
  });

  it('is titled FamilyFlix', () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe('FamilyFlix');
  });
});

describe('the renderer entry', () => {
  const imports = importsOf(readFileSync(ENTRY, 'utf8'));

  it.each(FACES)(
    'imports $family at $weight from @fontsource',
    ({ specifier }) => {
      expect(imports).toContain(specifier);
    }
  );

  it('is the one place a font is imported', () => {
    const importers = shippingSourcesMatching(SRC, /['"]@fontsource\//).map(
      (path) => path.slice(path.lastIndexOf('/src/') + 1)
    );

    expect(importers).toEqual(['src/main.tsx']);
  });
});

describe('the imported faces', () => {
  const require = createRequire(ENTRY);

  it.each(FACES)(
    'declare $family at $weight with every file on the origin',
    ({ family, weight, specifier }) => {
      const css = readFileSync(require.resolve(specifier), 'utf8');
      const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];

      expect(faces.length).toBeGreaterThan(0);
      for (const face of faces) {
        expect(face).toMatch(new RegExp(`font-family:\\s*['"]${family}['"]`));
        expect(face).toMatch(new RegExp(`font-weight:\\s*${weight}\\b`));
        const urls = [...face.matchAll(/url\(\s*['"]?([^'")]+)/g)].map(
          (match) => match[1]
        );
        expect(urls.length).toBeGreaterThan(0);
        expect(urls.filter((url) => /^([a-z]+:)?\/\//i.test(url))).toEqual([]);
      }
    }
  );
});
