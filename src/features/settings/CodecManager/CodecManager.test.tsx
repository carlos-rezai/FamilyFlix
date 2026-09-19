import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
 * one **Codec row** per catalogued codec the report contains. A report rather
 * than a manager, as this phase left it: no _Add a codec pack_ zone and no ✕.
 * The spec's `{ summaryLabel, codecs, onBrowse }` props collapse the way
 * `ExportModal`'s did — the organism reads the wire itself.
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
 * The zone and the ✕ arrive in the two phases below.
 *
 * 16 — Playback component upload, Phase 3: "the zone" (issue #154). The
 * organism grows the control it has so far only described: the **Component
 * drop zone**, composed **under** the rows, and the write behind it. Drop the
 * two **Component binaries** and the _Installed_ rows appear, the **Codec
 * summary** recounts, and the **Component row**'s pill reads **Uploaded** —
 * all from the report the route echoed, with no second read and no reload.
 * **Replaced is not a face**: there is no success flash to assert, because
 * the redrawn rows are the feedback. A refusal is drawn in the zone and
 * nowhere else, and the rows stay exactly as they were.
 *
 * 16 — Playback component upload, Phase 4: "the ✕ takes it back" (issue
 * #155). The other half of the **Component row**. The organism passes
 * `onRemove` into the optional prop the molecule already has **exactly when
 * the report says the component is removable** — an **Uploaded component**
 * and nothing else, because the **Default component** is the installer's
 * rather than the maintainer's. Pressing it removes immediately: **no
 * confirmation dialog**. The action is reversible by a drop, the files are
 * the maintainer's own download, and the default comes back underneath.
 * **Removed is not a face** either: the echoed report is the whole of the
 * redraw — the _Installed_ rows the component added go, the **Codec summary**
 * recounts, and the pill reads **Default** again, or the row goes with the
 * pair on a machine that has no default either.
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

  it('offers the zone under the rows, and no ✕ on a default component', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    // The **Default component** is the installer's rather than the
    // maintainer's, so no handler is passed and the 32px spacer stands where
    // the ✕ would — the negative half of Phase 4's rule.
    expect(screen.getByText('Add a codec pack')).toBeDefined();
    expect(screen.queryByText('✕')).toBeNull();
  });
});

/** The report after the swap: the pair is the maintainer's, and it adds more. */
const AFTER_UPLOAD: PlaybackCapabilities = {
  component: {
    source: 'uploaded',
    bytes: 101_000_000,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    native('h264', 'video'),
    native('vp9', 'video'),
    native('aac', 'audio'),
    added('hevc', 'video'),
    added('ac3', 'audio'),
    added('dts', 'audio'),
    added('av1', 'video'),
  ],
};

/** The two halves, as a drop hands them over. */
const PAIR = [new File(['MZ'], 'ffmpeg.exe'), new File(['MZ'], 'ffprobe.exe')];

/** A refusal the route named a reason for. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** The zone itself — the `<label>` the hidden input sits under. */
function zone(container: HTMLElement): HTMLElement {
  const label = container.querySelector('label');
  if (label === null) {
    throw new Error('CodecManager drew no drop zone');
  }
  return label;
}

/** Drop the pair on the zone, the one gesture the whole feature is for. */
async function dropPair(container: HTMLElement) {
  await act(async () => {
    fireEvent.drop(zone(container), {
      dataTransfer: { files: PAIR, types: ['Files'] },
    });
  });
}

describe('CodecManager — the zone under the rows', () => {
  it('draws the zone last, under the Component row', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    renderManager();

    await waitFor(() => expect(summary()).not.toBeNull());

    expect(
      comesBefore(
        screen.getByText('Playback component'),
        screen.getByText('Add a codec pack')
      )
    ).toBe(true);
  });

  it('takes a drop and posts the pair to the component route', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(summary()).not.toBeNull());

    fetchMock.mockResolvedValue(okResponse(AFTER_UPLOAD));
    await dropPair(container);

    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/playback/component');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
  });

  it('shows the Installed rows the component added, with no reload', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(summary()).not.toBeNull());
    expect(screen.queryByText('DTS Audio')).toBeNull();

    fetchMock.mockResolvedValue(okResponse(AFTER_UPLOAD));
    await dropPair(container);

    await waitFor(() => expect(screen.getByText('DTS Audio')).toBeDefined());
    expect(screen.getByText('AV1')).toBeDefined();
  });

  it('recounts the summary, so the line and the rows never disagree', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() =>
      expect(
        screen.getByText('5 formats enabled · 2 from the playback component')
      ).toBeDefined()
    );

    fetchMock.mockResolvedValue(okResponse(AFTER_UPLOAD));
    await dropPair(container);

    await waitFor(() =>
      expect(
        screen.getByText('7 formats enabled · 4 from the playback component')
      ).toBeDefined()
    );
  });

  it('flips the Component row’s pill to Uploaded from the echo alone', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());

    fetchMock.mockResolvedValue(okResponse(AFTER_UPLOAD));
    await dropPair(container);

    await waitFor(() => expect(screen.getByText('Uploaded')).toBeDefined());
    expect(screen.queryByText('Default')).toBeNull();
    // The read on mount and the write: no re-fetch, and no success flash.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads the busy copy while the copy and the check run', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(summary()).not.toBeNull());

    let settle: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
    );
    await dropPair(container);

    expect(screen.getByText('Adding the playback component…')).toBeDefined();

    await act(async () => {
      settle(okResponse(AFTER_UPLOAD));
    });
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeDefined());
  });

  it('draws a refusal in the zone and leaves the rows as they were', async () => {
    const said = "That isn't a working ffmpeg build.";
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(summary()).not.toBeNull());

    fetchMock.mockResolvedValue(refusedResponse(422, said));
    await dropPair(container);

    await waitFor(() => expect(screen.getByText(said)).toBeDefined());
    expect(
      screen.getByText('5 formats enabled · 2 from the playback component')
    ).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
    expect(screen.queryByText('DTS Audio')).toBeNull();
  });

  it('draws the fixed line when the route named no reason', async () => {
    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    const { container } = renderManager();
    await waitFor(() => expect(summary()).not.toBeNull());

    fetchMock.mockResolvedValue(serverErrorResponse());
    await dropPair(container);

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't add the playback component.")
      ).toBeDefined()
    );
  });
});

/** The report after the fall-back, with nothing underneath the upload. */
const NOTHING_LEFT: PlaybackCapabilities = WITHOUT_COMPONENT;

/** The ✕ on the **Component row**, by the name that says what it removes. */
const removeButton = () =>
  screen.queryByRole('button', { name: 'Remove Playback component' });

/** The manager with the report given already landed. */
async function mountedWith(report: PlaybackCapabilities) {
  fetchMock.mockResolvedValue(okResponse(report));
  const view = renderManager();
  await waitFor(() => expect(summary()).not.toBeNull());
  return view;
}

/** The one press this whole slice is for. */
async function pressRemove() {
  const button = removeButton();
  if (button === null) {
    throw new Error('the Component row carried no ✕');
  }
  await act(async () => {
    fireEvent.click(button);
  });
}

describe('CodecManager — the ✕ on the Component row', () => {
  it('carries a ✕ on an uploaded component, named for what it removes', async () => {
    await mountedWith(AFTER_UPLOAD);

    expect(removeButton()).not.toBeNull();
  });

  it('removes as soon as it is pressed, with nothing to confirm', async () => {
    await mountedWith(AFTER_UPLOAD);

    let settle: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
    );
    await pressRemove();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/playback/component');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE');

    await act(async () => {
      settle(okResponse(WITH_COMPONENT));
    });
  });

  it('reads the removing copy in the zone while the write runs', async () => {
    await mountedWith(AFTER_UPLOAD);

    let settle: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
    );
    await pressRemove();

    expect(screen.getByText('Removing the playback component…')).toBeDefined();
    expect(screen.getByText('The formats it added go with it')).toBeDefined();

    await act(async () => {
      settle(okResponse(WITH_COMPONENT));
    });
    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());
  });
});

describe('CodecManager — the fall-back redrawn', () => {
  it('drops the rows the component added and recounts the summary', async () => {
    await mountedWith(AFTER_UPLOAD);
    expect(screen.getByText('DTS Audio')).toBeDefined();

    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    await pressRemove();

    await waitFor(() => expect(screen.queryByText('DTS Audio')).toBeNull());
    expect(screen.queryByText('AV1')).toBeNull();
    expect(
      screen.getByText('5 formats enabled · 2 from the playback component')
    ).toBeDefined();
  });

  it('reads Default again, from the echoed report alone', async () => {
    await mountedWith(AFTER_UPLOAD);
    expect(screen.getByText('Uploaded')).toBeDefined();

    fetchMock.mockResolvedValue(okResponse(WITH_COMPONENT));
    await pressRemove();

    await waitFor(() => expect(screen.getByText('Default')).toBeDefined());
    expect(screen.queryByText('Uploaded')).toBeNull();
    expect(removeButton()).toBeNull();
    // The read on mount and the write: no re-fetch, and no removed face.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('leaves no Component row at all when there was no default underneath', async () => {
    // The whole row goes with the pair, the rule the codec rows already keep:
    // nothing to name, weigh or remove.
    await mountedWith(AFTER_UPLOAD);

    fetchMock.mockResolvedValue(okResponse(NOTHING_LEFT));
    await pressRemove();

    await waitFor(() =>
      expect(screen.queryByText('Playback component')).toBeNull()
    );
    expect(
      screen.getByText('3 formats enabled · no playback component')
    ).toBeDefined();
    expect(screen.getAllByText('Built-in')).toHaveLength(3);
  });

  it('draws a refused remove in the zone, the pair still live', async () => {
    const said =
      "The playback component is in use. Stop the film that's playing and try again.";
    await mountedWith(AFTER_UPLOAD);

    fetchMock.mockResolvedValue(refusedResponse(409, said));
    await pressRemove();

    await waitFor(() => expect(screen.getByText(said)).toBeDefined());
    expect(screen.getByText('Uploaded')).toBeDefined();
    expect(screen.getByText('DTS Audio')).toBeDefined();
    expect(removeButton()).not.toBeNull();
  });

  it('draws the remove’s own fixed line when the route named no reason', async () => {
    await mountedWith(AFTER_UPLOAD);

    fetchMock.mockResolvedValue(serverErrorResponse());
    await pressRemove();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't remove the playback component.")
      ).toBeDefined()
    );
  });
});
