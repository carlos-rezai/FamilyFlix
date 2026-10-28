// @vitest-environment node
//
// 53, Loading states, Phase 7 (issue #489): the **Start-up splash**.
// `splashPage` answers the `data:` URL the shell's window opens over at
// `whenReady`, before the server's `ready`: static HTML on `bg` with the 88px
// tile and the FF mark beating, a reduced-motion fade in place of the beat,
// and _Opening your library_. It is the window's first paint, so it can load
// nothing from the network or the server that isn't up yet.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { splashPage } from './splashPage';

/** The HTML a `data:` URL carries, base64 or percent-encoded. */
function decode(url: string): string {
  const comma = url.indexOf(',');
  const header = url.slice(0, comma);
  const body = url.slice(comma + 1);
  return header.endsWith(';base64')
    ? Buffer.from(body, 'base64').toString('utf8')
    : decodeURIComponent(body);
}

/** The `d` of each path in the brand mark: the two Fs. */
function markPaths(): string[] {
  const svg = readFileSync(
    fileURLToPath(
      new URL('../../docs/handoff/brand/familyflix-mark.svg', import.meta.url)
    ),
    'utf8'
  );
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
}

describe('splashPage', () => {
  it('answers a data: URL of HTML', () => {
    expect(splashPage()).toMatch(/^data:text\/html[;,]/);
  });

  it('draws Opening your library', () => {
    expect(decode(splashPage())).toContain('Opening your library');
  });

  it("carries both of the mark's F paths", () => {
    const html = decode(splashPage());
    const paths = markPaths();

    expect(paths).toHaveLength(2);
    for (const d of paths) expect(html).toContain(d);
  });

  it('carries a reduced-motion rule', () => {
    expect(decode(splashPage())).toMatch(
      /@media[^{]*prefers-reduced-motion:\s*reduce/
    );
  });

  it('loads nothing from the network or the server', () => {
    const html = decode(splashPage())
      // An SVG namespace names a vocabulary; nothing is fetched from it.
      .replace(/\sxmlns(:\w+)?="[^"]*"/g, '');

    expect(html).not.toMatch(/https?:/i);
    expect(html).not.toMatch(/\s(src|href)\s*=\s*["']?(?!#)/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/@import\b/i);
    expect(html).not.toMatch(/url\(\s*["']?(?!#)/i);
  });
});
