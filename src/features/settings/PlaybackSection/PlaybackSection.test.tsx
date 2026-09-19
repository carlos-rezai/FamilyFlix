import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PlaybackSection } from './PlaybackSection';
import {
  SUBTITLE_LANGUAGES,
  type PlaybackCapabilities,
  type Settings,
} from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143), and Phase 2:
 * "the Subtitles rows" (issue #144).
 *
 * The Settings hub's Playback **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Playback` **Group heading** over a
 * **Section card** that opens with _Codecs_ in 16px/600 and its lede in the
 * faint 13px at 440px max-width, over the **Codec report**. The lede keeps
 * both of the prototype's sentences though the _Add a codec pack_ zone the
 * second one points at is not drawn — so the copy does not move when the
 * **Playback component upload** lands.
 *
 * Under the report, the second half of the card: the `Divider`; _Subtitles_
 * with its lede; _Turn on automatically_ beside a **Coming soon** pill over
 * a `Toggle` drawn `checked={false} disabled` — it stores nothing and presses
 * to nothing, auto-on staying 🧭 exactly as log 10 decided; a rule; and
 * _Preferred language_ with `FilterDropdown` on the right, the seven names of
 * the **Language pool** as its options and the fetched value as its value.
 * The section owns `useSettings`; the pill is not drawn while the settings
 * are `null` — a refused read shows no default the server never confirmed.
 *
 * The report's own behaviour is `CodecManager`'s; here it is enough that the
 * section draws it under the header. The `fetch` stub answers both routes by
 * URL, and the write when the test says.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const REPORT: PlaybackCapabilities = {
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

const CAPABILITIES_ROUTE = '/api/playback/capabilities';
const SETTINGS_ROUTE = '/api/settings';
const WRITE_ROUTE = '/api/settings/subtitle-language';

/** A request that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

/**
 * Both reads answered at once — the report as `REPORT`, the settings as
 * `settings` — and the write held until the test says. A settings read that
 * is `null` is held instead.
 */
function answerWith(
  settings: Settings | null = { subtitleLanguage: 'English' }
) {
  const read = held();
  const write = held();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === CAPABILITIES_ROUTE) {
      return Promise.resolve(okResponse(REPORT));
    }
    if (url === SETTINGS_ROUTE) {
      return settings === null
        ? read.pending
        : Promise.resolve(okResponse(settings));
    }
    if (url === WRITE_ROUTE && init?.method === 'POST') {
      return write.pending;
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  });
  return { read, write };
}

/** The posts issued so far, as the values their bodies carried. */
function postedValues(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === WRITE_ROUTE && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
  answerWith();
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

const SUBTITLES_LEDE = 'How subtitles behave when a movie has them.';
const AUTO_ON_DESC = 'Show subtitles by default when a movie has them.';
const LANGUAGE_DESC = 'Which track to use whenever subtitles are shown.';

/** The report, landed. */
const reportLanded = () =>
  waitFor(() => expect(screen.getByText(/formats enabled/)).toBeDefined());

/** The _Preferred language_ pill, by the value it shows — or `null`. */
const languagePill = (value: string) =>
  screen.queryByRole('button', { name: `Preferred language: ${value}` });

/** Any _Preferred language_ pill at all — or `null`. */
const anyLanguagePill = () =>
  screen.queryByRole('button', { name: /^Preferred language: / });

/** The pill, landed with `value`. */
const pillLanded = async (value: string) => {
  await waitFor(() => expect(languagePill(value)).not.toBeNull());
  return languagePill(value) as HTMLElement;
};

/** Every row of the open language list, by its text. */
const openLanguages = () =>
  screen.queryAllByRole('menuitem').map((row) => row.textContent);

/** The auto-on switch. */
const autoOnSwitch = () =>
  screen.getByRole('switch', { name: 'Turn on automatically' });

/** Every hairline rule in the card: a 1px-tall block in the soft border ink. */
function rules(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('div')).filter((element) => {
    const style = getComputedStyle(element);
    return style.height === '1px' && element.childElementCount === 0;
  });
}

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

    await reportLanded();
    expect(screen.getByText('H.264 / AVC')).toBeDefined();
    expect(screen.getByText('H.265 / HEVC')).toBeDefined();
    expect(
      comesBefore(screen.getByText(LEDE), screen.getByText(/formats enabled/))
    ).toBe(true);
  });

  it('draws no Add a codec pack zone', async () => {
    renderSection();

    await reportLanded();
    expect(screen.queryByText(/add a codec pack/i)).toBeNull();
    expect(screen.queryByText(/drop a playback component/i)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /add a codec pack|browse/i })
    ).toBeNull();
  });
});

describe('PlaybackSection — the Subtitles header', () => {
  it('draws a rule after the codec rows, before Subtitles', async () => {
    const { container } = renderSection();

    await reportLanded();
    const rule = rules(container).find(
      (candidate) =>
        comesBefore(screen.getByText('H.265 / HEVC'), candidate) &&
        comesBefore(candidate, screen.getByText('Subtitles'))
    );
    expect(rule).toBeDefined();
  });

  it('titles the half Subtitles, in 16px at weight 600, with its lede', () => {
    renderSection();

    const title = screen.getByText('Subtitles');
    const style = getComputedStyle(title);
    expect(style.fontSize).toBe('16px');
    expect(style.fontWeight).toBe('600');
    expect(screen.getByText(SUBTITLES_LEDE)).toBeDefined();
    expect(
      comesBefore(
        screen.getByText('Subtitles'),
        screen.getByText(SUBTITLES_LEDE)
      )
    ).toBe(true);
  });

  it('keeps the Subtitles half under the Codecs half, in the one card', async () => {
    renderSection();

    await reportLanded();
    expect(
      comesBefore(
        screen.getByText(/formats enabled/),
        screen.getByText('Subtitles')
      )
    ).toBe(true);
    expect(screen.getAllByText('Playback')).toHaveLength(1);
  });
});

describe('PlaybackSection — Turn on automatically', () => {
  it('names the row, in 15px at weight 500, with its description', () => {
    renderSection();

    const title = screen.getByText('Turn on automatically');
    const style = getComputedStyle(title);
    expect(style.fontSize).toBe('15px');
    expect(style.fontWeight).toBe('500');
    expect(screen.getByText(AUTO_ON_DESC)).toBeDefined();
  });

  it('wears the Coming soon pill beside the title', () => {
    renderSection();

    const pill = screen.getByText('Coming soon');
    const style = getComputedStyle(pill);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontSize).toBe('11px');
    expect(comesBefore(screen.getByText('Turn on automatically'), pill)).toBe(
      true
    );
    expect(comesBefore(pill, screen.getByText(AUTO_ON_DESC))).toBe(true);
  });

  it('draws a disabled switch that is off', () => {
    renderSection();

    const control = autoOnSwitch();
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('aria-disabled')).toBe('true');
  });

  it('stores nothing and presses to nothing', async () => {
    renderSection();
    await pillLanded('English');

    fireEvent.click(autoOnSwitch());
    fireEvent.keyDown(autoOnSwitch(), { key: ' ' });

    expect(autoOnSwitch().getAttribute('aria-checked')).toBe('false');
    expect(postedValues()).toEqual([]);
  });

  it('draws a rule between the two rows', async () => {
    const { container } = renderSection();

    await pillLanded('English');
    const rule = rules(container).find(
      (candidate) =>
        comesBefore(screen.getByText(AUTO_ON_DESC), candidate) &&
        comesBefore(candidate, screen.getByText('Preferred language'))
    );
    expect(rule).toBeDefined();
  });
});

describe('PlaybackSection — Preferred language, the row', () => {
  it('names the row, in 15px at weight 500, with its description', () => {
    renderSection();

    const title = screen.getByText('Preferred language');
    const style = getComputedStyle(title);
    expect(style.fontSize).toBe('15px');
    expect(style.fontWeight).toBe('500');
    expect(screen.getByText(LANGUAGE_DESC)).toBeDefined();
  });

  it('draws the rows in the prototype’s order', () => {
    renderSection();

    expect(
      comesBefore(
        screen.getByText('Turn on automatically'),
        screen.getByText('Preferred language')
      )
    ).toBe(true);
  });
});

describe('PlaybackSection — Preferred language, the pill', () => {
  it('is absent until the settings land', () => {
    answerWith(null);

    renderSection();

    expect(anyLanguagePill()).toBeNull();
    // The row itself is there; only the value is not yet known.
    expect(screen.getByText('Preferred language')).toBeDefined();
  });

  it('stays absent on a refused read — no default the server never confirmed', async () => {
    const { read } = answerWith(null);
    renderSection();
    await reportLanded();

    read.settle(serverErrorResponse());
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => String(input) === SETTINGS_ROUTE
        )
      ).toHaveLength(1)
    );

    expect(anyLanguagePill()).toBeNull();
    expect(screen.queryByText('English')).toBeNull();
  });

  it('shows the fetched value once the settings land', async () => {
    answerWith({ subtitleLanguage: 'Spanish' });

    renderSection();

    const pill = await pillLanded('Spanish');
    expect(pill.textContent).toContain('Spanish');
  });

  it('is named Preferred language, with no caption on screen', async () => {
    answerWith({ subtitleLanguage: 'Spanish' });

    renderSection();

    const pill = await pillLanded('Spanish');
    expect(pill.textContent).not.toContain('Preferred language');
  });

  it('offers no list until it is pressed', async () => {
    renderSection();

    await pillLanded('English');

    expect(openLanguages()).toEqual([]);
  });

  it('offers the seven names of the pool, in its order', async () => {
    renderSection();
    const pill = await pillLanded('English');

    fireEvent.click(pill);

    expect(openLanguages()).toEqual([...SUBTITLE_LANGUAGES]);
    expect(openLanguages()).toEqual([
      'English',
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Italian',
      'Dutch',
    ]);
  });

  it('opens at 200px', async () => {
    renderSection();
    const pill = await pillLanded('English');

    fireEvent.click(pill);

    expect(getComputedStyle(screen.getByRole('menu')).minWidth).toBe('200px');
  });

  it('marks the fetched value as the current option', async () => {
    answerWith({ subtitleLanguage: 'French' });
    renderSection();
    const pill = await pillLanded('French');

    fireEvent.click(pill);

    const current = screen
      .getAllByRole('menuitem')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(current.map((row) => row.textContent)).toEqual(['French']);
  });
});

describe('PlaybackSection — choosing a language', () => {
  it('shows the choice at once, before the write has answered', async () => {
    renderSection();
    fireEvent.click(await pillLanded('English'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    expect(languagePill('Spanish')).not.toBeNull();
    expect(languagePill('English')).toBeNull();
  });

  it('posts the choice to the subtitle-language route', async () => {
    renderSection();
    fireEvent.click(await pillLanded('English'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    await waitFor(() => expect(postedValues()).toEqual(['Spanish']));
  });

  it('keeps the choice once the route echoes it', async () => {
    const { write } = answerWith();
    renderSection();
    fireEvent.click(await pillLanded('English'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    write.settle(okResponse({ value: 'Spanish' }));

    await waitFor(() => expect(postedValues()).toEqual(['Spanish']));
    await waitFor(() => expect(languagePill('Spanish')).not.toBeNull());
    expect(languagePill('English')).toBeNull();
  });

  it('reverts to the previous value when the route refuses', async () => {
    const { write } = answerWith();
    renderSection();
    fireEvent.click(await pillLanded('English'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));
    expect(languagePill('Spanish')).not.toBeNull();

    write.settle(serverErrorResponse());

    await waitFor(() => expect(languagePill('English')).not.toBeNull());
    expect(languagePill('Spanish')).toBeNull();
  });

  it('reverts when the request itself fails', async () => {
    const { write } = answerWith();
    renderSection();
    fireEvent.click(await pillLanded('English'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    write.refuse(new Error('offline'));

    await waitFor(() => expect(languagePill('English')).not.toBeNull());
  });

  it('shows no snackbar and no error face on a refusal', async () => {
    const { write } = answerWith();
    renderSection();
    fireEvent.click(await pillLanded('English'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    write.settle(serverErrorResponse());

    await waitFor(() => expect(languagePill('English')).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.queryByText(/could not|couldn’t|failed|try again/i)
    ).toBeNull();
  });

  it('shuts the list on a choice', async () => {
    renderSection();
    fireEvent.click(await pillLanded('English'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Spanish' }));

    expect(openLanguages()).toEqual([]);
  });
});
