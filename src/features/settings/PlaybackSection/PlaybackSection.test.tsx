import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PlaybackSection } from './PlaybackSection';
import type { PlaybackCapabilities } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * The Settings hub's Playback **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Playback` **Group heading** over a
 * **Section card** that opens with _Codecs_ in 16px/600 and its lede in the
 * faint 13px at 440px max-width, over the **Codec report**. The lede keeps
 * both of the prototype's sentences though the _Add a codec pack_ zone the
 * second one points at is not drawn — so the copy does not move when the
 * **Playback component upload** lands. The divider and the Subtitles half of
 * the card arrive in the next slice.
 *
 * The report's own behaviour is `CodecManager`'s; here it is enough that the
 * section draws it under the header.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const REPORT: PlaybackCapabilities = {
  component: true,
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

beforeEach(() => {
  fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(okResponse(REPORT));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSection() {
  return render(
    <ThemeProvider theme={theme}>
      <PlaybackSection />
    </ThemeProvider>
  );
}

const LEDE =
  'These decide which video files FamilyFlix can play. Common formats work ' +
  'out of the box — add a pack only if a movie won’t play.';

describe('PlaybackSection — the heading and the Codecs header', () => {
  it('is headed Playback', () => {
    renderSection();

    expect(screen.getByText('Playback')).toBeDefined();
  });

  it('opens the card with Codecs, in 16px at weight 600', () => {
    renderSection();

    const title = screen.getByText('Codecs');
    const style = getComputedStyle(title);
    expect(style.fontSize).toBe('16px');
    expect(style.fontWeight).toBe('600');
  });

  it('keeps both sentences of the lede, in the faint 13px at 440px', () => {
    renderSection();

    const lede = screen.getByText(LEDE);
    const style = getComputedStyle(lede);
    expect(style.fontSize).toBe('13px');
    expect(style.maxWidth).toBe('440px');
    expect(style.color).toBe('rgb(133, 122, 104)');
  });

  it('draws the heading, then Codecs, then the lede, in that order', () => {
    renderSection();

    expect(
      comesBefore(screen.getByText('Playback'), screen.getByText('Codecs'))
    ).toBe(true);
    expect(
      comesBefore(screen.getByText('Codecs'), screen.getByText(LEDE))
    ).toBe(true);
  });
});

describe('PlaybackSection — the report under the header', () => {
  it('draws the codec report once it lands, under the lede', async () => {
    renderSection();

    await waitFor(() =>
      expect(screen.getByText(/formats enabled/)).toBeDefined()
    );
    expect(screen.getByText('H.264 / AVC')).toBeDefined();
    expect(screen.getByText('H.265 / HEVC')).toBeDefined();
    expect(
      comesBefore(screen.getByText(LEDE), screen.getByText(/formats enabled/))
    ).toBe(true);
  });

  it('draws no Add a codec pack zone', async () => {
    renderSection();

    await waitFor(() =>
      expect(screen.getByText(/formats enabled/)).toBeDefined()
    );
    expect(screen.queryByText(/add a codec pack/i)).toBeNull();
    expect(screen.queryByText(/drop a playback component/i)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('draws no Subtitles half yet', () => {
    // The next slice's: the divider, the Subtitles header and its two rows
    // land under the same heading, in the same card.
    renderSection();

    expect(screen.queryByText('Subtitles')).toBeNull();
    expect(screen.queryByText(/turn on automatically/i)).toBeNull();
    expect(screen.queryByText(/preferred language/i)).toBeNull();
  });
});
