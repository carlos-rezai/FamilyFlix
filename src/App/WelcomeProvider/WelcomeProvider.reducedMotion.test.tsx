import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
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
 * 55, Intro animation, Phase 5 (issue #508): reduced motion (log 55 Q15).
 *
 * `matchMedia('(prefers-reduced-motion: reduce)')` is read once at start.
 * Under it nothing moves: no drop, letter rise, sweep or glide. The mark and
 * wordmark fade in over 300ms, the intro ends at 900ms, then the splash fades
 * out over 300ms while the home fades in from 100ms: a 400ms handoff, 1300ms
 * in all. The header wordmark is shown from the handoff's start. The splash's
 * fades carry `!important` on a selector that out-ranks `GlobalStyle`'s `*`,
 * as `LogoLoader`'s beat does, so the collapse never freezes them. The hold
 * and the skip behave as with full motion, on the shorter clock.
 *
 * jsdom runs no animation and knows no `@media`: what is drawn is read from
 * the unconditional rules styled-components injected (chosen by the provider
 * from its `matchMedia` read) and any inline style; the `@media` opt-out is
 * read from the stylesheet text.
 */

stubScrollMetrics(6390);

const INTRO = 900;
const HANDOFF = 400;
const SKIP = 150;

const REDUCE = '(prefers-reduced-motion: reduce)';

/** A `matchMedia` that answers yes to reduced motion and no to all else. */
function stubReducedMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: normCss(query) === normCss(REDUCE),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }))
  );
}

let releaseSettings: () => void = () => undefined;

/** Serves the settings at once: the home is ready long before the intro ends. */
function serveReadyHome() {
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(okResponse(makeSettings({ startTab: 'movies' })))
    )
  );
}

/** Holds the settings read until `ready()`: the home isn't ready till then. */
function serveSlowHome() {
  const waiting: Array<() => void> = [];
  releaseSettings = () => {
    for (const resolve of waiting.splice(0)) {
      resolve();
    }
  };
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () =>
        new Promise<Response>((resolve) => {
          waiting.push(() =>
            resolve(okResponse(makeSettings({ startTab: 'movies' })))
          );
        })
    )
  );
}

/** Lets the held settings read land, and the home mount on it. */
async function ready() {
  await act(async () => {
    releaseSettings();
  });
  await advanceClock(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('innerHeight', 540);
  stubReducedMotion();
  serveReadyHome();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const posterPointerDown = vi.fn<() => void>();
const posterKeyDown = vi.fn<() => void>();

beforeEach(() => {
  posterPointerDown.mockClear();
  posterKeyDown.mockClear();
});

function Home() {
  return (
    <StartTabGate>
      <MainLayout>
        <button
          type="button"
          onPointerDown={posterPointerDown}
          onKeyDown={posterKeyDown}
        >
          the poster
        </button>
      </MainLayout>
    </StartTabGate>
  );
}

/**
 * Starts a cold start, and checks the provider read reduced motion as it
 * did: every case here runs on the reduced clock, never by accident on the
 * full one.
 */
function renderWelcome() {
  const view = render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <WelcomeProvider>
          <Home />
        </WelcomeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  expect(window.matchMedia).toHaveBeenCalledWith(REDUCE);
  return view;
}

/**
 * Renders a ready home and runs the clock to `at`. The first 100ms go on
 * their own, so the settings read lands and the home mounts inside the intro.
 */
async function renderReadyHomeTo(at: number) {
  renderWelcome();
  await advanceClock(100);
  await advanceClock(at - 100);
}

const splash = () =>
  screen.queryByRole('status', { name: 'Opening FamilyFlix' });

function splashRoot(): HTMLElement {
  const root = splash();
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

/** The splash's drawn layer holding the wordmark's text. */
function wordmarkLayer(): Element {
  const layer = Array.from(splashRoot().children).find((child) =>
    /F\s*a\s*m\s*i\s*l\s*y/.test(child.textContent ?? '')
  );
  if (layer === undefined) {
    throw new Error('the splash draws no wordmark');
  }
  return layer;
}

/** The hold's `LogoLoader`, found past its `aria-hidden` layer. */
function holdLoader(): HTMLElement | null {
  const root = splash();
  if (root === null) {
    return null;
  }
  return within(root).queryByRole('status', { name: 'Loading', hidden: true });
}

/** The header's logo button: the first button in the banner. */
function logoButton(): HTMLButtonElement {
  const button = screen.getByRole('banner').querySelector('button');
  if (button === null) {
    throw new Error('the header has no logo button');
  }
  return button;
}

function headerWordmark(): Element {
  const mark = logoButton().firstElementChild;
  if (mark === null) {
    throw new Error('the logo button has no wordmark');
  }
  return mark;
}

const isHidden = (element: Element) =>
  getComputedStyle(element).visibility === 'hidden';

/** The home is up: no splash, the header wordmark shown, the logo focused. */
function expectHome() {
  expect(splash()).toBeNull();
  expect(isHidden(headerWordmark())).toBe(false);
  expect(document.activeElement).toBe(logoButton());
}

/** Whatever lies beneath the splash; with a slow home, the document body. */
function beneath(): Element {
  return screen.queryByRole('button', { name: 'the poster' }) ?? document.body;
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
  name: string;
  durationMs: number;
  delayMs: number;
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

/** The animations drawn on `element`, each with its frames. */
function animationsOf(element: Element): Animation[] {
  const style = styleOf(element);
  const animations: Animation[] = [];
  const shorthand = style.animation;
  if (shorthand !== undefined && shorthand !== 'none') {
    for (const one of splitTop(shorthand, /,/)) {
      const tokens = splitTop(one, /\s/);
      for (const token of tokens) {
        const frames = keyframesNamed(token);
        if (frames === null) continue;
        const times = tokens.filter(isTime).map(toMs);
        animations.push({
          name: token,
          durationMs: times[0] ?? 0,
          delayMs: times[1] ?? 0,
          frames,
        });
        break;
      }
    }
  }
  const name = style['animation-name'];
  if (name !== undefined) {
    const frames = keyframesNamed(name);
    if (frames !== null) {
      animations.push({
        name,
        durationMs: toMs(style['animation-duration'] ?? '0s'),
        delayMs: toMs(style['animation-delay'] ?? '0s'),
        frames,
      });
    }
  }
  return animations;
}

/** The properties an animation's frames change. */
const animatedProperties = (animation: Animation) =>
  new Set(
    Object.values(animation.frames).flatMap((frame) => Object.keys(frame))
  );

/** The properties a `transition` on `element` eases, `all` included. */
function transitionedProperties(element: Element): string[] {
  const style = styleOf(element);
  const shorthand = style.transition;
  const listed =
    style['transition-property'] ??
    (shorthand === undefined || shorthand === 'none'
      ? ''
      : splitTop(shorthand, /,/)
          .map((one) => splitTop(one, /\s/)[0])
          .join(','));
  return listed
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '' && one !== 'none');
}

/** The layer and everything in it, outermost first. */
const subtree = (element: Element) => [
  element,
  ...Array.from(element.querySelectorAll('*')),
];

/** `element` and its ancestors up to, but not including, `stop`. */
function chain(element: Element, stop: Element | null): Element[] {
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

const opacityAt = (animation: Animation, offset: string) =>
  animation.frames[offset]?.opacity;

const isFadeIn = (animation: Animation) =>
  normCss(opacityAt(animation, '0%') ?? '') === '0' &&
  normCss(opacityAt(animation, '100%') ?? '') === '1';

const isFadeOut = (animation: Animation) =>
  normCss(opacityAt(animation, '100%') ?? '') === '0';

/** Every animation on `elements`. */
const animationsOn = (elements: Element[]) => elements.flatMap(animationsOf);

/** Asserts nothing in the splash moves: every animation and transition is opacity alone. */
function expectNothingMoves() {
  const drawn = subtree(splashRoot());
  const animations = animationsOn(drawn);
  expect(animations.length).toBeGreaterThan(0);
  for (const animation of animations) {
    expect(
      [...animatedProperties(animation)],
      `${animation.name} animates more than opacity`
    ).toEqual(['opacity']);
  }
  for (const element of drawn) {
    for (const property of transitionedProperties(element)) {
      expect(property, 'a transition moves something').toBe('opacity');
    }
  }
}

/** The rules inside every `prefers-reduced-motion: reduce` block. */
function reducedMotionRules(css: string) {
  const blocks = [
    ...css.matchAll(
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g
    ),
  ].map(([, body]) => body);
  return blocks.flatMap((body) =>
    [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      ([, selector, declarations]) => ({
        selector: selector.trim(),
        declarations,
      })
    )
  );
}

/** Whether `selector` (a list, pseudo-elements dropped) names `element`. */
function names(selector: string, element: Element): boolean {
  return selector.split(',').some((one) => {
    const bare = one.replace(/::?[\w-]+$/, '').trim();
    if (bare === '' || bare === '*') return false;
    try {
      return element.matches(bare);
    } catch {
      return false;
    }
  });
}

/**
 * Asserts some reduced-motion rule names one of `elements` with an
 * `!important` animation that survives `GlobalStyle`'s `*`: a selector that
 * out-ranks it, no collapsed duration, and keyframes that only fade.
 */
function expectOptedOut(elements: Element[], what: string) {
  const css = injectedCss();
  const rules = reducedMotionRules(css).filter(
    ({ selector, declarations }) =>
      /animation/.test(declarations) &&
      elements.some((element) => names(selector, element))
  );
  expect(rules.length, `no reduced-motion rule names ${what}`).toBeGreaterThan(
    0
  );
  for (const { selector, declarations } of rules) {
    expect(declarations, what).toMatch(/animation[^;]*!important/);
    expect(selector, what).toMatch(/[.#[]/);
    expect(declarations, what).not.toMatch(/0?\.01ms/);
    const name =
      /animation-name\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
      splitTop(
        /animation\s*:\s*([^;]+)/.exec(declarations)?.[1] ?? '',
        /\s/
      ).find((token) => keyframesNamed(token) !== null) ??
      '';
    const frames = keyframesNamed(name);
    expect(frames, `${what}'s reduced-motion keyframes`).not.toBeNull();
    const properties = new Set(
      Object.values(frames ?? {}).flatMap((frame) => Object.keys(frame))
    );
    expect([...properties], `${what} only fades`).toEqual(['opacity']);
  }
}

// ---------------------------------------------------------------------------

describe('WelcomeProvider under reduced motion: the timeline', () => {
  it('reads prefers-reduced-motion through matchMedia', async () => {
    renderWelcome();
    await advanceClock(100);

    expect(window.matchMedia).toHaveBeenCalledWith(REDUCE);
  });

  it('ends the intro at 900ms: the header wordmark is shown from the handoff’s start', async () => {
    await renderReadyHomeTo(INTRO - 1);
    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(true);

    await advanceClock(1);
    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
  });

  it('is gone at 900ms plus 400ms, with focus on the logo button', async () => {
    await renderReadyHomeTo(INTRO + HANDOFF - 1);
    expect(splash()).not.toBeNull();

    await advanceClock(1);
    expectHome();
  });
});

describe('WelcomeProvider under reduced motion: nothing moves', () => {
  it('no drop, letter rise or sweep animates in the intro', async () => {
    await renderReadyHomeTo(100);

    expectNothingMoves();
  });

  it('fades the mark and the wordmark in over 300ms', async () => {
    await renderReadyHomeTo(100);

    const markFade = animationsOn(chain(markSvg(), splashRoot())).find(
      isFadeIn
    );
    expect(markFade).toBeDefined();
    expect(markFade?.durationMs).toBe(300);

    const wordmarkFades = animationsOn([
      ...chain(wordmarkLayer(), splashRoot()),
      ...subtree(wordmarkLayer()),
    ]).filter(isFadeIn);
    expect(wordmarkFades.length).toBeGreaterThan(0);
    for (const fade of wordmarkFades) {
      expect(fade.durationMs).toBe(300);
    }
  });

  it('no glide, no mark shrink: the handoff only fades', async () => {
    await renderReadyHomeTo(INTRO);

    expectNothingMoves();
  });

  it('fades the splash out over 300ms from the handoff’s start', async () => {
    await renderReadyHomeTo(INTRO);

    const fades = animationsOn(subtree(splashRoot())).filter(isFadeOut);
    expect(fades.length).toBeGreaterThan(0);
    for (const fade of fades) {
      expect(fade.durationMs).toBe(300);
      expect(fade.delayMs).toBe(0);
    }
  });

  it('fades the home in from 100ms, done by the handoff’s 400ms', async () => {
    await renderReadyHomeTo(INTRO);

    const fadeIn = animationsOn(
      chain(screen.getByRole('banner'), document.body)
    ).find(isFadeIn);
    expect(fadeIn).toBeDefined();
    expect(fadeIn?.delayMs).toBe(100);
    expect((fadeIn?.delayMs ?? 0) + (fadeIn?.durationMs ?? Infinity)).toBe(
      HANDOFF
    );
  });
});

describe('WelcomeProvider under reduced motion: GlobalStyle’s collapse', () => {
  it('opts the intro’s mark and wordmark fades out of it with !important on a selector that out-ranks *', async () => {
    await renderReadyHomeTo(100);

    expectOptedOut(chain(markSvg(), splashRoot()), 'the mark');
    expectOptedOut(
      [...chain(wordmarkLayer(), splashRoot()), ...subtree(wordmarkLayer())],
      'the wordmark'
    );
  });

  it('opts the splash’s fade out of it the same way', async () => {
    await renderReadyHomeTo(INTRO);

    const fading = subtree(splashRoot()).filter((element) =>
      animationsOf(element).some(isFadeOut)
    );
    expect(fading.length).toBeGreaterThan(0);
    expectOptedOut(fading, 'the splash fade-out');
  });
});

describe('WelcomeProvider under reduced motion: the Welcome hold', () => {
  it('holds a home not ready at 900ms on the loader', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO);

    expect(splash()).not.toBeNull();
    expect(holdLoader()).not.toBeNull();

    await advanceClock(10_000);
    expect(splash()).not.toBeNull();
    expect(holdLoader()).not.toBeNull();
  });

  it('never holds before 900ms', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO - 1);

    expect(holdLoader()).toBeNull();
  });

  it('hands off on ready: the splash stays the handoff’s 400ms, then the home', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO + 3000);

    await ready();
    await advanceClock(HANDOFF - 1);
    expect(splash()).not.toBeNull();

    await advanceClock(1);
    expectHome();
  });

  it('still plays a home ready early to 900ms, never holding', async () => {
    await renderReadyHomeTo(INTRO - 1);
    expect(splash()).not.toBeNull();
    expect(holdLoader()).toBeNull();

    await advanceClock(1);
    expect(holdLoader()).toBeNull();
    await advanceClock(HANDOFF - 1);
    expect(splash()).not.toBeNull();

    await advanceClock(1);
    expectHome();
  });
});

type Skip = (target: Element) => boolean;

const skips: Array<[string, Skip]> = [
  ['a pointerdown', (target) => fireEvent.pointerDown(target)],
  ['a keydown', (target) => fireEvent.keyDown(target, { key: 'Enter' })],
];

describe('WelcomeProvider under reduced motion: the skip', () => {
  describe.each(skips)('%s', (_, skip) => {
    it.each([
      ['in intro', 100],
      ['in handoff', INTRO + 100],
    ])(
      'with the home ready, %s, takes the splash at once and shows the home in 150ms',
      async (__, at) => {
        await renderReadyHomeTo(at);
        expect(splash()).not.toBeNull();
        expect(isHidden(headerWordmark())).toBe(at < INTRO);

        act(() => {
          skip(beneath());
        });
        expect(splash()).toBeNull();

        await advanceClock(SKIP);
        expectHome();
      }
    );

    it('in holding goes straight to the home in 150ms on ready', async () => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(INTRO + 200);
      expect(holdLoader()).not.toBeNull();

      act(() => {
        skip(beneath());
      });
      await ready();
      await advanceClock(SKIP);

      expectHome();
    });

    it('before ready, in intro, holds on the loader, then the home in 150ms on ready', async () => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(100);

      act(() => {
        skip(beneath());
      });
      await advanceClock(0);
      expect(holdLoader()).not.toBeNull();

      await advanceClock(3000);
      expect(splash()).not.toBeNull();

      await ready();
      await advanceClock(SKIP);
      expectHome();
    });
  });

  it.each([
    ['in intro', 100],
    ['in handoff', INTRO + 100],
  ])(
    'swallows the skipping input %s: prevented, never reaching the home',
    async (_, at) => {
      await renderReadyHomeTo(at);
      expect(isHidden(headerWordmark())).toBe(at < INTRO);
      const poster = screen.getByRole('button', { name: 'the poster' });

      let pointerNotPrevented = true;
      act(() => {
        pointerNotPrevented = fireEvent.pointerDown(poster);
      });
      expect(pointerNotPrevented).toBe(false);
      expect(posterPointerDown).not.toHaveBeenCalled();
    }
  );

  it('swallows a keydown in intro: prevented, never reaching the home', async () => {
    await renderReadyHomeTo(100);
    const poster = screen.getByRole('button', { name: 'the poster' });

    let keyNotPrevented = true;
    act(() => {
      keyNotPrevented = fireEvent.keyDown(poster, { key: 'Enter' });
    });
    expect(keyNotPrevented).toBe(false);
    expect(posterKeyDown).not.toHaveBeenCalled();
  });

  it('lets input reach the home once done', async () => {
    await renderReadyHomeTo(INTRO + HANDOFF);
    expectHome();
    const poster = screen.getByRole('button', { name: 'the poster' });

    act(() => {
      fireEvent.pointerDown(poster);
      fireEvent.keyDown(poster, { key: 'Enter' });
    });

    expect(posterPointerDown).toHaveBeenCalledTimes(1);
    expect(posterKeyDown).toHaveBeenCalledTimes(1);
  });
});
