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

import { SLOW_START_MS, splashPage } from './splashPage';

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

// 55, Intro animation, Phase 1 (issue #503): the F paths now live in
// `src/tokens/brand.ts`. The shell imports only types from `src/`, so the page
// keeps its own copy, and its docblock names the token file as the source.
describe('splashPage: its copy of the mark', () => {
  it('names src/tokens/brand.ts as the source of its F paths', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./splashPage.ts', import.meta.url)),
      'utf8'
    );
    const docblocks = [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)]
      .map((match) => match[0])
      .join('\n');

    expect(docblocks).toMatch(/src\/tokens\/brand\.ts/);
  });
});

// 55, Intro animation, refactor (issue #509): the **Start-up splash** gives
// way to the **Welcome splash**. Its first paint is bare `bg`, the welcome's
// first frame; the tile and _Opening your library_ fade in only on a **Slow
// start**, a server not ready `SLOW_START_MS` after the window opened.
describe('splashPage: a slow start', () => {
  /** The body of the block opened by `head`, a line of the page's style. */
  function block(html: string, head: string): string {
    const start = html.indexOf(`\n${head} {`);
    if (start === -1) {
      throw new Error(`no block for ${head}`);
    }
    const open = html.indexOf('{', start);
    return html.slice(open + 1, html.indexOf('\n}', open));
  }

  /** The declarations of the rule whose selector is `selector`. */
  function rule(html: string, selector: string): string {
    const body = block(html, selector);
    return body.slice(0, body.indexOf('}'));
  }

  /** The class of the one element holding both the tile and the line. */
  function groupClass(html: string): string {
    const match = html.match(
      /<div class="([\w-]+)">\s*<svg[\s\S]*?<\/svg>\s*<p role="status">Opening your library<\/p>\s*<\/div>/
    );
    if (match === null) {
      throw new Error('the tile and the line stand in no one group');
    }
    return match[1];
  }

  it('exports SLOW_START_MS, 2000', () => {
    expect(SLOW_START_MS).toBe(2000);
  });

  it('keeps the body bare bg, the welcome’s first frame', () => {
    expect(rule(decode(splashPage()), 'html, body')).toMatch(
      /background:\s*#14110d\s*;/
    );
  });

  it('draws the tile and the line in one group, at opacity 0', () => {
    const html = decode(splashPage());

    expect(rule(html, `.${groupClass(html)}`)).toMatch(/opacity:\s*0\s*;/);
  });

  it('fades the group in over 300ms ease-out from SLOW_START_MS, fill both', () => {
    const html = decode(splashPage());
    const declarations = rule(html, `.${groupClass(html)}`);
    const animation = declarations.match(/animation:\s*([^;]+);/);
    expect(animation).not.toBeNull();
    const parts = (animation?.[1] ?? '').trim().split(/\s+/);

    expect(parts.filter((part) => /^\d+m?s$/.test(part))).toEqual([
      '300ms',
      `${SLOW_START_MS}ms`,
    ]);
    expect(parts).toContain('ease-out');
    expect(parts).toContain('both');
    const name = parts.find((part) => html.includes(`@keyframes ${part} {`));
    expect(name).toBeDefined();
    expect(block(html, `@keyframes ${name}`)).toMatch(/to\s*\{\s*opacity:\s*1/);
  });
});
