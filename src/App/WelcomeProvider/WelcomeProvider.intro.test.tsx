import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { MARK_F1, MARK_F2 } from '@/tokens';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';
import { StartTabGate } from '@/features/library/StartTabGate/StartTabGate';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

import { WelcomeProvider } from './WelcomeProvider';

/**
 * 55, Intro animation, Phase 4 (issue #506): the **Welcome intro**.
 *
 * The prototype's keyframes, verbatim, on the PRD's timeline (log 55,
 * _Design_, and Q16): the Fs drop (`ffDrop`) from 0 and 150ms for 520ms on
 * `easeDrop`; letter i rises and unblurs (`ffLetter`) from `520 + i·40` for
 * 420ms on `easeOut`; a 220-unit band sweeps each F (`ffSweep`, −260 to +760)
 * from 1000ms for 700ms on `easeSweep`, clipped to its own F, orange over F1
 * and white over F2; and a transparent copy of each glyph, its background
 * clipped to the text, sweeps (`ffTextSweep`, 160% to −60%) from
 * `1150 + i·45` for 380ms linear, orange over _Family_ and white over _Flix_.
 *
 * jsdom runs no animation, so what is drawn is read from the stylesheets
 * styled-components injected (and any inline style): each animation's timing
 * from its declaration, and its frames from its `@keyframes` block.
 */

stubScrollMetrics(6390);

const WORD = 'FamilyFlix';

/** The **Welcome intro**'s length: the handoff starts here. */
const INTRO = 1950;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(okResponse(makeSettings({ startTab: 'movies' })))
    )
  );
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('innerHeight', 540);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function Home() {
  return (
    <StartTabGate>
      <MainLayout>
        <p>the browse home</p>
      </MainLayout>
    </StartTabGate>
  );
}

/** A cold start, run 100ms into the **Welcome intro**. */
async function renderIntro() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <WelcomeProvider>
          <Home />
        </WelcomeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await advanceClock(100);
}

function splashRoot(): HTMLElement {
  const root = screen.queryByRole('status', { name: 'Opening FamilyFlix' });
  if (root === null) {
    throw new Error('no splash is drawn');
  }
  return root;
}

function markSvg(): SVGSVGElement {
  const svg = splashRoot().querySelector('svg');
  if (svg === null) {
    throw new Error('the splash draws no mark');
  }
  return svg;
}

/** Every element under `element`, by its local name. */
const byName = (element: Element, localName: string) =>
  Array.from(element.querySelectorAll('*')).filter(
    (one) => one.localName === localName
  );

const inClipPath = (element: Element) =>
  byName(markSvg(), 'clipPath').some((clip) => clip.contains(element));

/** The drawn F carrying `d`: its path outside any `clipPath`. */
function drawnFs(d: string): Element[] {
  return byName(markSvg(), 'path').filter(
    (path) => path.getAttribute('d') === d && !inClipPath(path)
  );
}

function drawnF(d: string): Element {
  const [f, ...rest] = drawnFs(d);
  if (f === undefined || rest.length > 0) {
    throw new Error('the mark draws that F other than once');
  }
  return f;
}

// ---------------------------------------------------------------------------
// Reading what the stylesheets draw
// ---------------------------------------------------------------------------

type Frame = Record<string, string>;
/** A keyframes block's frames by offset, `from` as `0%` and `to` as `100%`. */
type Frames = Record<string, Frame>;

/** Every style tag's text, as styled-components injected it. */
function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function declarationsOf(body: string): Frame {
  const declarations: Frame = {};
  for (const raw of body.split(';')) {
    const colon = raw.indexOf(':');
    if (colon <= 0) continue;
    declarations[raw.slice(0, colon).trim()] = normCss(
      raw.slice(colon + 1).replace(/!important/, '')
    );
  }
  return declarations;
}

/** A named `@keyframes` block's frames, or `null`. */
function keyframesNamed(name: string): Frames | null {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const block = new RegExp(
    `@keyframes\\s+${escaped}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`
  ).exec(injectedCss());
  if (block === null) return null;
  const frames: Frames = {};
  for (const [, selector, body] of block[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = declarationsOf(body);
    for (const raw of selector.split(',').map((s) => s.trim())) {
      const offset = raw === 'from' ? '0%' : raw === 'to' ? '100%' : raw;
      frames[offset] = { ...frames[offset], ...declarations };
    }
  }
  return frames;
}

/** The stylesheets' resolved style for `element`, its inline style on top. */
function styleOf(element: Element): Record<string, string> {
  return {
    ...resolvedStyle(element),
    ...declarationsOf(element.getAttribute('style') ?? ''),
  };
}

interface Animation {
  durationMs: number;
  delayMs: number;
  easing: string | undefined;
  frames: Frames;
}

/** Splits on `separator` outside parentheses. */
function splitTop(value: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && separator.test(char)) {
      if (current.trim() !== '') parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

const toMs = (time: string) =>
  time.endsWith('ms') ? parseFloat(time) : parseFloat(time) * 1000;

const isTime = (token: string) => /^-?[\d.]+m?s$/.test(token);
const isEasing = (token: string) =>
  /^(cubic-bezier\(|steps\(|ease|linear)/.test(token);

/** The animations drawn on `element`, each with its frames. */
function animationsOf(element: Element): Animation[] {
  const style = styleOf(element);
  const animations: Animation[] = [];
  const shorthand = style.animation;
  if (shorthand !== undefined && shorthand !== 'none') {
    for (const one of splitTop(shorthand, /,/)) {
      const tokens = splitTop(one, /\s/);
      const frames = tokens
        .map((token) => keyframesNamed(token))
        .find((found) => found !== null);
      if (frames === undefined || frames === null) continue;
      const times = tokens.filter(isTime).map(toMs);
      animations.push({
        durationMs: times[0] ?? 0,
        delayMs: times[1] ?? 0,
        easing: tokens.find(isEasing),
        frames,
      });
    }
  }
  const name = style['animation-name'];
  if (name !== undefined) {
    const frames = keyframesNamed(name);
    if (frames !== null) {
      animations.push({
        durationMs: toMs(style['animation-duration'] ?? '0s'),
        delayMs: toMs(style['animation-delay'] ?? '0s'),
        easing: style['animation-timing-function'],
        frames,
      });
    }
  }
  return animations;
}

/** `frames` with every value as `normCss` writes it. */
function norm(frames: Frames): Frames {
  return Object.fromEntries(
    Object.entries(frames).map(([offset, frame]) => [
      offset,
      Object.fromEntries(
        Object.entries(frame).map(([property, value]) => [
          property,
          normCss(value),
        ])
      ),
    ])
  );
}

const sameFrames = (a: Frames, b: Frames) =>
  JSON.stringify(Object.entries(norm(a)).sort()) ===
  JSON.stringify(Object.entries(norm(b)).sort());

/** `element` and its ancestors up to, but not including, `stop`. */
function chain(element: Element, stop: Element): Element[] {
  const elements: Element[] = [];
  for (
    let node: Element | null = element;
    node !== null && node !== stop;
    node = node.parentElement
  ) {
    elements.push(node);
  }
  return elements;
}

/** The animation on `element` or an ancestor that runs `frames`. */
function animationRunning(
  element: Element,
  frames: Frames
): Animation | undefined {
  for (const one of chain(element, splashRoot())) {
    const found = animationsOf(one).find((animation) =>
      sameFrames(animation.frames, frames)
    );
    if (found !== undefined) return found;
  }
  return undefined;
}

// The prototype's keyframes (`Welcome Splash.dc.html`), verbatim.

const FF_DROP: Frames = {
  '0%': { opacity: '0', transform: 'translateY(-70%)' },
  '55%': { opacity: '1', transform: 'translateY(5%)' },
  '75%': { transform: 'translateY(-3%)' },
  '100%': { opacity: '1', transform: 'none' },
};

const FF_LETTER: Frames = {
  '0%': { opacity: '0', transform: 'translateY(60%)', filter: 'blur(4px)' },
  '100%': { opacity: '1', transform: 'none', filter: 'none' },
};

const FF_SWEEP: Frames = {
  '0%': { transform: 'translateX(-260px)' },
  '100%': { transform: 'translateX(760px)' },
};

const FF_TEXT_SWEEP: Frames = {
  '0%': { 'background-position': '160% 0' },
  '100%': { 'background-position': '-60% 0' },
};

// ---------------------------------------------------------------------------
// The wordmark's glyphs and the mark's bands
// ---------------------------------------------------------------------------

/** The splash's drawn layer holding the wordmark's glyphs. */
function wordmarkLayer(): Element {
  const layer = Array.from(splashRoot().children).find(
    (child) => (child.textContent ?? '').trim() !== ''
  );
  if (layer === undefined) {
    throw new Error('the splash draws no wordmark');
  }
  return layer;
}

/** Every non-blank text node in the wordmark, in document order. */
function glyphTexts(): Text[] {
  const walker = document.createTreeWalker(
    wordmarkLayer(),
    NodeFilter.SHOW_TEXT
  );
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim() !== '') texts.push(node as Text);
  }
  return texts;
}

const clipsToText = (element: Element) => {
  const style = styleOf(element);
  return (
    style['background-clip'] === 'text' ||
    style['-webkit-background-clip'] === 'text'
  );
};

/** The glyph elements: the letters that rise, then their sweep copies. */
function glyphs(): { letters: Element[]; copies: Element[] } {
  const holders = glyphTexts().map((text) => {
    if (text.parentElement === null) {
      throw new Error('a glyph has no element');
    }
    return text.parentElement;
  });
  return {
    letters: holders.filter((holder) => !clipsToText(holder)),
    copies: holders.filter(clipsToText),
  };
}

/** The mark's sweep bands: what in the mark runs `ffSweep`. */
function bands(): Element[] {
  return Array.from(markSvg().querySelectorAll('*')).filter((element) =>
    animationsOf(element).some((animation) =>
      sameFrames(animation.frames, FF_SWEEP)
    )
  );
}

/** The id a `url(#id)` names, or `null`. */
const urlId = (value: string | null | undefined) =>
  /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/.exec(value ?? '')?.[1] ?? null;

/** The `clipPath` that clips `band`, from it or an ancestor in the mark. */
function clipOf(band: Element): Element | undefined {
  for (const element of chain(band, markSvg())) {
    const id =
      urlId(element.getAttribute('clip-path')) ??
      urlId(styleOf(element)['clip-path']);
    if (id !== null) {
      return byName(markSvg(), 'clipPath').find((clip) => clip.id === id);
    }
  }
  return undefined;
}

/** The gradient `band` is filled with. */
function gradientOf(band: Element): Element | undefined {
  const id =
    urlId(band.getAttribute('fill')) ?? urlId(styleOf(band).fill ?? null);
  return byName(markSvg(), 'linearGradient').find(
    (gradient) => gradient.id === id
  );
}

/** A colour as `[r, g, b]`. */
function rgbOf(color: string | null | undefined): number[] {
  const value = (color ?? '').trim().toLowerCase();
  if (value === 'white') return [255, 255, 255];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
  if (hex !== undefined) {
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(([^)]*)\)$/.exec(value)?.[1];
  if (rgb !== undefined) {
    return rgb
      .split(/[\s,/]+/)
      .slice(0, 3)
      .map((n) => parseFloat(n));
  }
  return [];
}

/** The band's peak: its gradient's middle stop, as colour and opacity. */
function peakOf(band: Element): { rgb: number[]; opacity: number } {
  const gradient = gradientOf(band);
  const stops = gradient === undefined ? [] : byName(gradient, 'stop');
  const middle = stops.find(
    (stop) => parseFloat(stop.getAttribute('offset') ?? '') === 0.5
  );
  if (middle === undefined) {
    throw new Error('the band has no middle stop');
  }
  const style = styleOf(middle);
  return {
    rgb: rgbOf(middle.getAttribute('stop-color') ?? style['stop-color']),
    opacity: parseFloat(
      middle.getAttribute('stop-opacity') ?? style['stop-opacity'] ?? '1'
    ),
  };
}

const isHiddenWithinSplash = (element: Element) => {
  const hidden = element.closest('[aria-hidden="true"]');
  return hidden !== null && splashRoot().contains(hidden);
};

// ---------------------------------------------------------------------------

describe('WelcomeProvider: the intro draws its layers', () => {
  it('draws two Fs, ten letters and their sweep layers, all aria-hidden', async () => {
    await renderIntro();

    const f1 = drawnF(MARK_F1);
    const f2 = drawnF(MARK_F2);

    const { letters, copies } = glyphs();
    expect(glyphTexts().every((text) => text.data.trim().length === 1)).toBe(
      true
    );
    expect(letters.map((letter) => letter.textContent?.trim()).join('')).toBe(
      WORD
    );
    expect(copies.map((copy) => copy.textContent?.trim()).join('')).toBe(WORD);
    expect(bands()).toHaveLength(2);

    for (const layer of Array.from(splashRoot().children)) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
    }
    for (const drawn of [f1, f2, ...letters, ...copies, ...bands()]) {
      expect(isHiddenWithinSplash(drawn)).toBe(true);
    }
  });
});

describe('WelcomeProvider: the intro runs to the timeline', () => {
  it.each([
    ['F1', 0, MARK_F1],
    ['F2', 150, MARK_F2],
  ])(
    '%s drops (ffDrop) from %ims for 520ms on easeDrop',
    async (_, delayMs, d) => {
      await renderIntro();

      const drop = animationRunning(drawnF(d), FF_DROP);
      expect(drop).toBeDefined();
      expect(drop?.delayMs).toBe(delayMs);
      expect(drop?.durationMs).toBe(520);
      expect(drop?.easing).toBe(normCss(theme.motion.easeDrop));
    }
  );

  it('letter i rises and unblurs (ffLetter) from 520 + i·40 for 420ms on easeOut', async () => {
    await renderIntro();

    const { letters } = glyphs();
    expect(letters).toHaveLength(WORD.length);
    letters.forEach((letter, i) => {
      const rise = animationRunning(letter, FF_LETTER);
      expect(rise, `letter ${i}, ${WORD[i]}`).toBeDefined();
      expect(rise?.delayMs, `letter ${i}'s delay`).toBe(520 + i * 40);
      expect(rise?.durationMs, `letter ${i}'s duration`).toBe(420);
      expect(rise?.easing, `letter ${i}'s curve`).toBe(
        normCss(theme.motion.easeOut)
      );
    });
  });
});

describe('WelcomeProvider: the mark sweep', () => {
  it('names its clip paths and gradients with ids free of useId’s colons', async () => {
    await renderIntro();

    const ids = [
      ...byName(markSvg(), 'clipPath'),
      ...byName(markSvg(), 'linearGradient'),
    ].map((element) => element.id);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('clips each F’s 220-unit band to its own path and sweeps it (ffSweep) from 1000ms for 700ms on easeSweep', async () => {
    await renderIntro();

    const clipped = bands().map((band) => {
      const clip = clipOf(band);
      expect(clip).toBeDefined();
      const paths = clip === undefined ? [] : byName(clip, 'path');
      expect(paths).toHaveLength(1);
      return { band, d: paths[0]?.getAttribute('d') };
    });
    expect(clipped.map(({ d }) => d).sort()).toEqual([MARK_F1, MARK_F2].sort());

    for (const { band } of clipped) {
      expect(band.getAttribute('width')).toBe('220');
      const sweep = animationsOf(band).find((animation) =>
        sameFrames(animation.frames, FF_SWEEP)
      );
      expect(sweep?.delayMs).toBe(1000);
      expect(sweep?.durationMs).toBe(700);
      expect(sweep?.easing).toBe(normCss(theme.motion.easeSweep));
    }
  });

  it('shines orange rgb(255,150,90) at 0.95 over F1 and white at 0.7 over F2', async () => {
    await renderIntro();

    const over = (d: string) => {
      const band = bands().find(
        (one) => byName(clipOf(one) ?? one, 'path')[0]?.getAttribute('d') === d
      );
      if (band === undefined) {
        throw new Error('no band is clipped to that F');
      }
      return peakOf(band);
    };
    expect(over(MARK_F1)).toEqual({ rgb: [255, 150, 90], opacity: 0.95 });
    expect(over(MARK_F2)).toEqual({ rgb: [255, 255, 255], opacity: 0.7 });
  });
});

describe('WelcomeProvider: the letter sweep', () => {
  const band = (rgb: string, peak: string) =>
    normCss(
      `linear-gradient(100deg, rgba(${rgb},0) 30%, rgba(${rgb},${peak}) 50%, rgba(${rgb},0) 70%)`
    );

  it('sweeps Family in orange at 1 and Flix in white at 0.9, a 100° band 300% wide clipped to each transparent glyph', async () => {
    await renderIntro();

    const { copies } = glyphs();
    expect(copies).toHaveLength(WORD.length);
    copies.forEach((copy, i) => {
      const style = styleOf(copy);
      const flix = i > 5;
      expect(style['background-image'], `glyph ${i}, ${WORD[i]}`).toBe(
        flix ? band('255,255,255', '0.9') : band('255,150,90', '1')
      );
      expect(style['background-size'], `glyph ${i}'s band width`).toBe(
        '300% 100%'
      );
      expect(style.color, `glyph ${i}'s ink`).toBe('transparent');
    });
  });

  it('paints each copy’s band once, never repeated onto the glyph before or after its run', async () => {
    await renderIntro();

    const { copies } = glyphs();
    expect(copies).toHaveLength(WORD.length);
    copies.forEach((copy, i) => {
      expect(styleOf(copy)['background-repeat'], `glyph ${i}, ${WORD[i]}`).toBe(
        'no-repeat'
      );
    });
  });

  it('ends every letter’s sweep before the intro ends, so no light is left for the glide', async () => {
    await renderIntro();

    const { copies } = glyphs();
    expect(copies).toHaveLength(WORD.length);
    copies.forEach((copy, i) => {
      const sweep = animationRunning(copy, FF_TEXT_SWEEP);
      expect(sweep, `glyph ${i}, ${WORD[i]}`).toBeDefined();
      expect(
        (sweep?.delayMs ?? 0) + (sweep?.durationMs ?? 0),
        `glyph ${i}'s sweep end`
      ).toBeLessThanOrEqual(INTRO);
    });
  });

  it('runs letter sweep i (ffTextSweep, 160% to −60%) from 1150 + i·45 for 380ms linear', async () => {
    await renderIntro();

    const { copies } = glyphs();
    expect(copies).toHaveLength(WORD.length);
    copies.forEach((copy, i) => {
      const sweep = animationRunning(copy, FF_TEXT_SWEEP);
      expect(sweep, `glyph ${i}, ${WORD[i]}`).toBeDefined();
      expect(sweep?.delayMs, `glyph ${i}'s delay`).toBe(1150 + i * 45);
      expect(sweep?.durationMs, `glyph ${i}'s duration`).toBe(380);
      expect(sweep?.easing, `glyph ${i}'s curve`).toBe('linear');
    });
  });
});
