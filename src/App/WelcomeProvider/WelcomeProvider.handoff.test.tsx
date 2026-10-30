import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
 * 55, Intro animation, Phase 3 (issue #505): the **Wordmark handoff** lands
 * on the header.
 *
 * At the handoff's start the provider measures the header's wordmark (its
 * `getBoundingClientRect()` and computed `font-size`), and the splash
 * wordmark glides (`ffToHeader`, the prototype's keyframes with the end
 * computed) to that rect's top-left, scaled by the header's size over the
 * splash's `30·scale`. The splash wordmark is drawn in the header's
 * typography at the splash's size. The mark (`ffMarkOut`), the background
 * (`ffOut`) and the **Home layer** (`ffIn`) run their handoff keyframes with
 * the PRD's delays and durations, counted from the handoff's start.
 *
 * jsdom lays nothing out, so the header wordmark's rect is stubbed, and what
 * is drawn is read from the injected stylesheets: each animation's timing
 * from its declaration, and its end from its `@keyframes` block.
 */

stubScrollMetrics(6390);

const INTRO = 1950;
const HANDOFF = 500;

/** The header `LogoMark`'s `font-size`. */
const HEADER_SIZE = 25;

/** Where the stubbed header wordmark sits. */
const HEADER_RECT = { left: 24, top: 18, width: 168, height: 33 };

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(okResponse(makeSettings({ startTab: 'movies' })))
    )
  );
  stubWindow(960, 540);
  stubHeaderRect();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function stubWindow(width: number, height: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
}

/** The header's **Wordmark**: the banner's first element, never a control. */
function findHeaderWordmark(): Element | null {
  return (
    document.querySelector('[role="banner"], header')?.firstElementChild ?? null
  );
}

/** The header wordmark measures at `HEADER_RECT`; everything else at 0. */
function stubHeaderRect() {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      if (this === findHeaderWordmark()) {
        const { left, top, width, height } = HEADER_RECT;
        return new DOMRect(left, top, width, height);
      }
      return original.call(this);
    }
  );
}

function Home() {
  return (
    <StartTabGate>
      <MainLayout>
        <p>the browse home</p>
      </MainLayout>
    </StartTabGate>
  );
}

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <WelcomeProvider>
          <Home />
        </WelcomeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
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

function headerWordmark(): Element {
  const mark = findHeaderWordmark();
  if (mark === null) {
    throw new Error('the header has no wordmark');
  }
  return mark;
}

const isHidden = (element: Element) =>
  getComputedStyle(element).visibility === 'hidden';

/** Every style tag's text, as styled-components injected it. */
function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

type Frame = Record<string, string>;

/** A named `@keyframes` block's first and last frames, or `null`. */
function keyframes(name: string): { from: Frame; to: Frame } | null {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const block = new RegExp(
    `@keyframes\\s+${escaped}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`
  ).exec(injectedCss());
  if (block === null) return null;
  const frames: { from: Frame; to: Frame } = { from: {}, to: {} };
  for (const [, selector, body] of block[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Frame = {};
    for (const raw of body.split(';')) {
      const colon = raw.indexOf(':');
      if (colon <= 0) continue;
      declarations[raw.slice(0, colon).trim()] = normCss(
        raw.slice(colon + 1).replace(/!important/, '')
      );
    }
    for (const one of selector.split(',').map((s) => s.trim())) {
      if (one === 'from' || one === '0%')
        Object.assign(frames.from, declarations);
      if (one === 'to' || one === '100%')
        Object.assign(frames.to, declarations);
    }
  }
  return frames;
}

interface Animation {
  durationMs: number;
  delayMs: number;
  easing: string | undefined;
  from: Frame;
  to: Frame;
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

/** The animations the stylesheets draw on `element`, each with its frames. */
function animationsOf(element: Element): Animation[] {
  const style = resolvedStyle(element);
  const shorthand = style.animation;
  const animations: Animation[] = [];
  if (shorthand !== undefined && shorthand !== 'none') {
    for (const one of splitTop(shorthand, /,/)) {
      const tokens = splitTop(one, /\s/);
      const frames = tokens
        .map((token) => keyframes(token))
        .find((found) => found !== null);
      if (frames === undefined || frames === null) continue;
      const times = tokens.filter(isTime).map(toMs);
      animations.push({
        durationMs: times[0] ?? 0,
        delayMs: times[1] ?? 0,
        easing: tokens.find(isEasing),
        ...frames,
      });
    }
  }
  const name = style['animation-name'];
  if (name !== undefined) {
    const frames = keyframes(name);
    if (frames !== null) {
      animations.push({
        durationMs: toMs(style['animation-duration'] ?? '0s'),
        delayMs: toMs(style['animation-delay'] ?? '0s'),
        easing: style['animation-timing-function'],
        ...frames,
      });
    }
  }
  return animations;
}

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

/** The first animation on `elements` that ends as `ends` says. */
function findAnimation(
  elements: Element[],
  ends: (to: Frame) => boolean
): Animation | undefined {
  for (const element of elements) {
    const found = animationsOf(element).find(({ to }) => ends(to));
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The splash's drawn layer holding the wordmark's text. */
function splashWordmarkLayer(): Element {
  const layer = Array.from(splashRoot().children).find((child) =>
    /Family/.test(child.textContent ?? '')
  );
  if (layer === undefined) {
    throw new Error('the splash draws no wordmark');
  }
  return layer;
}

/** The layer and everything in it, outermost first. */
const subtree = (element: Element) => [
  element,
  ...Array.from(element.querySelectorAll('*')),
];

/** The glide: the wordmark's animation that ends at a `left` and `top`. */
function glide(): Animation | undefined {
  return findAnimation(
    subtree(splashWordmarkLayer()),
    (to) => to.left !== undefined && to.top !== undefined
  );
}

/** The scale a `transform` ends on, or `NaN`. */
function scaleOf(transform: string | undefined): number {
  const match = /scale\(([-\d.]+)\)/.exec(transform ?? '');
  return match === null ? NaN : parseFloat(match[1]);
}

/** Starts the welcome and runs it to the handoff's first frame. */
async function toHandoff() {
  renderWelcome();
  await advanceClock(INTRO);
  expect(splash()).not.toBeNull();
}

describe('WelcomeProvider: the glide lands on the header', () => {
  it.each([
    ['960 × 540, scale 2', 960, 540, 2],
    ['1440 × 1080, scale 3', 1440, 1080, 3],
  ])(
    'at %s the glide ends at the measured header rect, scaled by its size over the splash’s',
    async (_, width, height, scale) => {
      stubWindow(width, height);
      await toHandoff();

      const landing = glide();
      expect(landing).toBeDefined();
      expect(landing?.to.left).toBe(`${HEADER_RECT.left}px`);
      expect(landing?.to.top).toBe(`${HEADER_RECT.top}px`);
      expect(scaleOf(landing?.to.transform)).toBeCloseTo(
        HEADER_SIZE / (30 * scale),
        3
      );
    }
  );

  it('glides for 500ms on easeGlide from the handoff’s start, about its top-left corner', async () => {
    await toHandoff();

    const landing = glide();
    expect(landing?.durationMs).toBe(500);
    expect(landing?.delayMs).toBe(0);
    expect(landing?.easing).toBe(normCss(theme.motion.easeGlide));

    const glider = subtree(splashWordmarkLayer()).find((element) =>
      animationsOf(element).some(({ to }) => to.left !== undefined)
    );
    expect(glider).toBeDefined();
    expect(resolvedStyle(glider as Element)['transform-origin']).toBe('0 0');
  });

  it('keeps the header wordmark hidden through the glide and shows it in the frame the splash unmounts', async () => {
    await toHandoff();
    expect(glide()).toBeDefined();

    for (let at = 0; at < HANDOFF - 50; at += 50) {
      await advanceClock(50);
      expect(splash()).not.toBeNull();
      expect(isHidden(headerWordmark())).toBe(true);
    }
    await advanceClock(49);
    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(true);

    await advanceClock(1);
    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
  });
});

describe('WelcomeProvider: the splash wordmark is the header’s typography', () => {
  /** `value` in px, an `em` read against `fontPx`. */
  function toPx(value: string | undefined, fontPx: number): number {
    if (value === undefined) return NaN;
    if (value.endsWith('em')) return parseFloat(value) * fontPx;
    if (value.endsWith('px')) return parseFloat(value);
    return NaN;
  }

  /** An inherited property as the wordmark's glyphs get it. */
  function inherited(glyph: Element, property: string): string | undefined {
    for (const element of chain(glyph, splashRoot())) {
      const value = resolvedStyle(element)[property];
      if (value !== undefined && value !== 'inherit') return value;
    }
    return undefined;
  }

  /** The element drawing the `F` of _Family_: the wordmark's first glyph. */
  function firstGlyph(): Element {
    const glyph = subtree(splashWordmarkLayer())
      .reverse()
      .find((element) => /^F/.test(element.textContent ?? ''));
    if (glyph === undefined) {
      throw new Error('the splash wordmark draws no F');
    }
    return glyph;
  }

  it('is the theme’s serif 700 at 30·scale, line-height normal, with the header’s 0.3px tracking and 2px word gap at the splash scale', async () => {
    renderWelcome();
    await advanceClock(100);
    const glyph = firstGlyph();
    const fontPx = 30 * 2;
    const ratio = fontPx / HEADER_SIZE;

    expect(inherited(glyph, 'font-family')).toBe(normCss(theme.fonts.serif));
    expect(inherited(glyph, 'font-weight')).toBe('700');
    expect(inherited(glyph, 'font-size')).toBe(`${fontPx}px`);
    expect(inherited(glyph, 'line-height')).toBe('normal');

    expect(toPx(inherited(glyph, 'letter-spacing'), fontPx)).toBeCloseTo(
      0.3 * ratio,
      3
    );

    const gaps = subtree(splashWordmarkLayer())
      .map((element) => {
        const style = resolvedStyle(element);
        return toPx(style.gap ?? style['column-gap'], fontPx);
      })
      .filter((gap) => !Number.isNaN(gap));
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0]).toBeCloseTo(2 * ratio, 3);
  });
});

describe('WelcomeProvider: the handoff’s other layers', () => {
  it('fades and shrinks the mark over 300ms ease-out from the handoff’s start', async () => {
    await toHandoff();
    const svg = splashRoot().querySelector('svg');
    expect(svg).not.toBeNull();

    const out = findAnimation(
      chain(svg as Element, splashRoot()),
      (to) => to.opacity === '0' && Math.abs(scaleOf(to.transform) - 0.7) < 1e-6
    );
    expect(out).toBeDefined();
    expect(out?.durationMs).toBe(300);
    expect(out?.delayMs).toBe(0);
    expect(out?.easing).toBe(normCss(theme.motion.easeOut));
  });

  it('fades the background out from 50ms for 400ms', async () => {
    await toHandoff();
    const background = Array.from(splashRoot().children).find(
      (layer) =>
        layer.childElementCount === 0 && (layer.textContent ?? '') === ''
    );
    expect(background).toBeDefined();

    const out = findAnimation(
      [background as Element],
      (to) => to.opacity === '0'
    );
    expect(out).toBeDefined();
    expect(out?.durationMs).toBe(400);
    expect(out?.delayMs).toBe(50);
  });

  it('fades the Home layer in from 100ms for 400ms ease-out', async () => {
    await toHandoff();

    const fadeIn = findAnimation(
      chain(screen.getByRole('banner'), document.body),
      (to) => to.opacity === '1'
    );
    expect(fadeIn).toBeDefined();
    expect(fadeIn?.durationMs).toBe(400);
    expect(fadeIn?.delayMs).toBe(100);
    expect(fadeIn?.easing).toBe(normCss(theme.motion.easeOut));
  });
});
