import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CodecManager } from './CodecManager';
import type {
  CodecCapability,
  PlaybackCapabilities,
  PlaybackComponentInfo,
} from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * The **Codec report**, `feat.CodecManager.dc.html` → `CodecManager`: the
 * organism that owns `useCapabilities` and draws the **Codec summary** over
 * one **Codec row** per catalogued codec the report contains. A report, not a
 * manager: no _Add a codec pack_ zone and no ✕ until the **Playback component
 * upload** ships. The spec's `{ summaryLabel, codecs, onBrowse }` props
 * collapse the way `ExportModal`'s did — the organism reads the wire itself.
 *
 * **Blank until it lands**: nothing at all while the report is `null`, and
 * nothing still on a refused read. No skeleton, no error face.
 *
 * Read through what is on screen, the `ExportModal` precedent, over a stubbed
 * `fetch`.
 *
 * ---
 *
 * 16 — Playback component upload, Phase 1: "the slot resolves what is live,
 * and it has a row" (issue #152). The organism grows the one row that has a
 * size and a source: the **Component row**, drawn **last**, under every codec
 * row — and absent on a machine with no component at all. The **Codec
 * summary** counts the codec rows only; the ffmpeg pair is not a film format.
 * Still no zone and still no ✕: nothing passes a remove handler until Phase 4.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const native = (codec: string, kind: 'video' | 'audio'): CodecCapability => ({
  codec,
  kind,
  support: 'native',
});

const added = (codec: string, kind: 'video' | 'audio'): CodecCapability => ({
  codec,
  kind,
  support: 'via-component',
});

/** The **Default component**: what `ffmpegBinary` resolved on this machine. */
const DEFAULT_COMPONENT: PlaybackComponentInfo = {
  source: 'default',
  bytes: 98_765_432,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

/** A machine with a component: Chromium's set, plus what ffmpeg adds. */
const WITH_COMPONENT: PlaybackCapabilities = {
  component: DEFAULT_COMPONENT,
  codecs: [
    native('h264', 'video'),
    native('vp9', 'video'),
    native('aac', 'audio'),
    added('hevc', 'video'),
    added('ac3', 'audio'),
    added('pcm_s16le', 'audio'),
    added('rawvideo', 'video'),
  ],
};

/** A machine with none: the native rows alone, and no Component row. */
const WITHOUT_COMPONENT: PlaybackCapabilities = {
  component: null,
  codecs: [
    native('h264', 'video'),
    native('vp9', 'video'),
    native('aac', 'audio'),
  ],
};

/** A read that answers only when the test says so. */
function holdRead() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  fetchMock.mockImplementation(() => pending);
  return { settle: (response: Response) => settle(response) };
}

function renderManager() {
  return render(
    <ThemeProvider theme={theme}>
      <CodecManager />
    </ThemeProvider>
  );
}

const summary = () => screen.queryByText(/formats enabled/);

describe('CodecManager — blank until it lands', () => {
  it('renders nothing while the report has not landed', () => {
    holdRead();

    const { container } = renderManager();

    expect(container.textContent).toBe('');
    expect(summary()).toBeNull();
  });

  it('renders nothing on a refused read', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { container } = renderManager();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toBe('');
    expect(summary()).toBeNull();
  });

  it('reads the report once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));

    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/playback/capabilities'
    );
  });
});

describe('CodecManager — once the report lands', () => {
  it('draws the summary line over the rows', async () => {
    const read = holdRead();
    renderManager();

    await act(async () => {
      read.settle(okResponse(WITH_COMPONENT));
    });

    await waitFor(() =>
      expect(
        screen.getByText('5 formats enabled · 2 from the playback component')
      ).toBeDefined()
    );
    expect(
      comesBefore(
        screen.getByText(/formats enabled/),
        screen.getByText('H.264 / AVC')
      )
    ).toBe(true);
  });

  it('draws one row per catalogued codec, in catalogue order', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    const names = [
      'H.264 / AVC',
      'H.265 / HEVC',
      'VP9',
      'AAC Audio',
      'AC-3 / Dolby Digital',
    ];
    for (const name of names) {
      expect(screen.getByText(name)).toBeDefined();
    }
    for (let index = 1; index < names.length; index += 1) {
      expect(
        comesBefore(
          screen.getByText(names[index - 1]),
          screen.getByText(names[index])
        )
      ).toBe(true);
    }
  });

  it('draws no row for a decoder the catalogue does not name', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.queryByText(/pcm_s16le/)).toBeNull();
    expect(screen.queryByText(/rawvideo/)).toBeNull();
    expect(screen.getAllByText(/Built-in|Installed/)).toHaveLength(5);
  });

  it('marks each row Built-in or Installed as the report says', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.getAllByText('Built-in')).toHaveLength(3);
    expect(screen.getAllByText('Installed')).toHaveLength(2);
  });

  it('says there is no playback component for a report without one', async () => {
    fetchMock.mockResolvedValue(okResponse(WITHOUT_COMPONENT));
    renderManager();

    await waitFor(() =>
      expect(
        screen.getByText('3 formats enabled · no playback component')
      ).toBeDefined()
    );
    expect(screen.getAllByText('Built-in')).toHaveLength(3);
    expect(screen.queryByText('Installed')).toBeNull();
  });

  it('draws no Component row for a machine with none', async () => {
    // Nothing to name, weigh or remove: the absence of the row is how the
    // screen says so, the rule the codec rows already keep.
    fetchMock.mockResolvedValue(okResponse(WITHOUT_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.queryByText('Playback component')).toBeNull();
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('draws the Component row last, under every codec row', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    const componentRow = screen.getByText('Playback component');
    for (const name of [
      'H.264 / AVC',
      'H.265 / HEVC',
      'VP9',
      'AAC Audio',
      'AC-3 / Dolby Digital',
    ]) {
      expect(comesBefore(screen.getByText(name), componentRow)).toBe(true);
    }
  });

  it('draws the pair’s basenames and its size on that row', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.getByText('ffmpeg.exe')).toBeDefined();
    expect(screen.getByText('ffprobe.exe')).toBeDefined();
    expect(screen.getByText('94.2 MB')).toBeDefined();
  });

  it('says Default for the component the machine came with', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.getByText('Default')).toBeDefined();
    expect(screen.queryByText('Uploaded')).toBeNull();
  });

  it('counts the codec rows alone in the summary', async () => {
    // Six rows are drawn and five formats are enabled: the ffmpeg pair is not
    // a film format, and a family reading the line is reading how many films
    // play.
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() =>
      expect(
        screen.getByText('5 formats enabled · 2 from the playback component')
      ).toBeDefined()
    );
    expect(screen.getAllByText(/Built-in|Installed|Default/)).toHaveLength(6);
  });

  it('offers no control — no Add a codec pack zone, no ✕', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/add a codec pack/i)).toBeNull();
    expect(screen.queryByText('✕')).toBeNull();
  });
});
