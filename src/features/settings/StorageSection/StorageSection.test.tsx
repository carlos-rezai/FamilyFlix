import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StorageSection } from './StorageSection';
import type { StorageReport } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
 *
 * The Settings hub's Storage **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Storage` **Group heading** over a
 * **Section card** that puts a number on the **Managed media directory**
 * which agrees with Explorer. _Managed media folder_ in 16px/600 with the
 * folder's absolute path under it in mono at 13px, faint, on one line with an
 * ellipsis when long; under it the space line — **Space used** in bold, _of
 * movies_, a faint `·`, and `N titles` / `1 title` for one. No _Change…_: a
 * control whose mechanism does not exist is not drawn, the title and path
 * alone on their line.
 *
 * The section owns `useStorageReport`. **Blank until it lands**: the path and
 * the space line are empty while the report is `null` and left so if it
 * never lands — the title alone. The `fetch` stub answers the storage route
 * when the test says.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const STORAGE_ROUTE = '/api/storage';

const REPORT: StorageReport = {
  mediaPath: 'D:\\FamilyFlix\\media',
  bytesUsed: 19_756_849_562,
  movieCount: 12,
};

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

/** The storage read answered at once with `report`, or held while `null`. */
function answerWith(report: StorageReport | null = REPORT) {
  const read = held();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url === STORAGE_ROUTE) {
      return report === null
        ? read.pending
        : Promise.resolve(okResponse(report));
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  });
  return { read };
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
      <StorageSection />
    </ThemeProvider>
  );
}

const TITLE = 'Managed media folder';

/** The report, landed: the path is on screen. */
const reportLanded = (path = REPORT.mediaPath) =>
  waitFor(() => expect(screen.getByText(path)).toBeDefined());

/** Text with its whitespace collapsed, the way a reader sees it. */
const collapsed = (text: string | null) =>
  (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * The space line — the innermost element whose text runs _… of movies …_,
 * however its spans are cut — or `null`.
 */
const spaceLine = () =>
  screen.queryByText((_, element) => {
    if (element === null || !/of movies/.test(collapsed(element.textContent))) {
      return false;
    }
    return !Array.from(element.children).some((child) =>
      /of movies/.test(collapsed(child.textContent))
    );
  });

/** The space line's text, whitespace collapsed. */
const spaceLineText = () => collapsed(spaceLine()?.textContent ?? null);

describe('StorageSection — the heading and the title', () => {
  it('is headed Storage', () => {
    renderSection();

    expect(screen.getByText('Storage')).toBeDefined();
  });

  it('opens the card with Managed media folder, in 16px at weight 600', () => {
    renderSection();

    const title = screen.getByText(TITLE);
    const style = getComputedStyle(title);
    expect(style.fontSize).toBe('16px');
    expect(style.fontWeight).toBe('600');
  });

  it('draws the heading, then the title', () => {
    renderSection();

    expect(
      comesBefore(screen.getByText('Storage'), screen.getByText(TITLE))
    ).toBe(true);
  });

  it('draws no Change… button — the title and path alone on their line', async () => {
    renderSection();

    await reportLanded();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/change/i)).toBeNull();
  });
});

describe('StorageSection — the path', () => {
  it('shows the path from the report, under the title', async () => {
    renderSection();

    await reportLanded();
    expect(
      comesBefore(screen.getByText(TITLE), screen.getByText(REPORT.mediaPath))
    ).toBe(true);
  });

  it('shows the path as the report spelled it, whatever the disk', async () => {
    answerWith({
      ...REPORT,
      mediaPath: 'C:\\Users\\Family\\AppData\\Roaming\\FamilyFlix\\media',
    });

    renderSection();

    await reportLanded(
      'C:\\Users\\Family\\AppData\\Roaming\\FamilyFlix\\media'
    );
  });

  it('sets the path in mono at 13px, faint', async () => {
    renderSection();

    await reportLanded();
    const style = getComputedStyle(screen.getByText(REPORT.mediaPath));
    expect(style.fontFamily).toMatch(/mono/i);
    expect(style.fontSize).toBe('13px');
    expect(style.color).toBe('rgb(133, 122, 104)');
  });

  it('keeps the path to one line, with an ellipsis when long', async () => {
    renderSection();

    await reportLanded();
    const style = getComputedStyle(screen.getByText(REPORT.mediaPath));
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.overflow).toBe('hidden');
    expect(style.textOverflow).toBe('ellipsis');
  });
});

describe('StorageSection — the space line', () => {
  it('writes the bytes as 18.4 GB, in bold', async () => {
    renderSection();

    await reportLanded();
    const bytes = screen.getByText('18.4 GB');
    const style = getComputedStyle(bytes);
    expect(style.fontWeight).toBe('700');
    expect(style.color).toBe('rgb(243, 236, 224)');
  });

  it('reads 18.4 GB of movies · 12 titles for that report', async () => {
    renderSection();

    await reportLanded();
    expect(spaceLineText()).toBe('18.4 GB of movies · 12 titles');
  });

  it('draws the dot faint', async () => {
    renderSection();

    await reportLanded();
    expect(getComputedStyle(screen.getByText('·')).color).toBe(
      'rgb(133, 122, 104)'
    );
  });

  it('draws the space line under the path', async () => {
    renderSection();

    await reportLanded();
    expect(
      comesBefore(
        screen.getByText(REPORT.mediaPath),
        spaceLine() as HTMLElement
      )
    ).toBe(true);
  });

  it('writes 1 title for one', async () => {
    answerWith({ ...REPORT, bytesUsed: 1_610_612_736, movieCount: 1 });

    renderSection();

    await reportLanded();
    expect(spaceLineText()).toBe('1.5 GB of movies · 1 title');
    expect(screen.queryByText(/1 titles/)).toBeNull();
  });

  it('writes 0 B for zero bytes', async () => {
    answerWith({ ...REPORT, bytesUsed: 0, movieCount: 0 });

    renderSection();

    await reportLanded();
    expect(screen.getByText('0 B')).toBeDefined();
    expect(spaceLineText()).toBe('0 B of movies · 0 titles');
  });

  it('counts what the report counts — the bytes and the titles are two numbers', async () => {
    // A Stranded folder: bytes on disk with no title behind them. The card
    // tells the truth about both.
    answerWith({ ...REPORT, bytesUsed: 7_234, movieCount: 1 });

    renderSection();

    await reportLanded();
    expect(spaceLineText()).toBe('7.1 KB of movies · 1 title');
  });
});

describe('StorageSection — before the report lands', () => {
  it('shows nothing but the title while the report is null', () => {
    answerWith(null);

    renderSection();

    expect(screen.getByText('Storage')).toBeDefined();
    expect(screen.getByText(TITLE)).toBeDefined();
    expect(screen.queryByText(REPORT.mediaPath)).toBeNull();
    expect(spaceLine()).toBeNull();
    expect(screen.queryByText(/titles?$/)).toBeNull();
    expect(screen.queryByText(/\d+(\.\d)? [KMGT]?B/)).toBeNull();
  });

  it('stays so on a refused read — no path and no number the server never gave', async () => {
    const { read } = answerWith(null);
    renderSection();

    read.settle(serverErrorResponse());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(TITLE)).toBeDefined();
    expect(spaceLine()).toBeNull();
    expect(screen.queryByText(/0 B/)).toBeNull();
    expect(screen.queryByText(/titles?$/)).toBeNull();
  });

  it('shows no snackbar and no error face on a refusal', async () => {
    const { read } = answerWith(null);
    renderSection();

    read.refuse(new Error('offline'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.queryByText(/could not|couldn’t|failed|try again/i)
    ).toBeNull();
  });

  it('fills the path and the space line once it lands', async () => {
    const { read } = answerWith(null);
    renderSection();
    expect(spaceLine()).toBeNull();

    read.settle(okResponse(REPORT));

    await reportLanded();
    expect(spaceLineText()).toBe('18.4 GB of movies · 12 titles');
  });
});
