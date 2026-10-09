import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { ExportModal } from './ExportModal';
import { theme } from '@/styles/theme';
import type { ExportSummary } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 31 — Export options, Phase 5: "_Browse…_" (issue #280).
 *
 * The revised `feat.ExportModal.dc.html` draws _Browse…_ — a `secondary`,
 * `sm` Button — beside the _Save to_ field, and only when the desktop shell's
 * folder bridge exists. A browser draws no button; typing still works. A
 * press opens the one-folder dialog, and the folder picked reads in the
 * field.
 *
 * The wire is a stubbed `fetch` answering the summary; the dialog is
 * `fakeFolderBridge`.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(() => Promise.resolve(okResponse(SUMMARY)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SUMMARY: ExportSummary = {
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  folderName: 'familyflix-collection_08-10-2026',
};

function renderDialog() {
  return render(
    <ThemeProvider theme={theme}>
      <ExportModal open onClose={() => undefined} />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Export library' });
const saveTo = () =>
  within(dialog()).getByRole('textbox', {
    name: 'Save to',
  }) as HTMLInputElement;
const browseButton = () =>
  within(dialog()).queryByRole('button', { name: 'Browse…' });

describe('ExportModal — Browse… in a browser', () => {
  it('draws no Browse…', async () => {
    renderDialog();

    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    expect(browseButton()).toBeNull();
  });
});

describe('ExportModal — Browse… in the desktop app', () => {
  const bridge = fakeFolderBridge();

  it('draws Browse… beside Save to', async () => {
    renderDialog();

    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    const button = browseButton();
    expect(button).not.toBeNull();
    if (button !== null) {
      expect(comesBefore(saveTo(), button)).toBe(true);
    }
  });

  it('reads the folder picked into Save to', async () => {
    bridge.setPickOne('F:\\Backup');
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));

    const button = browseButton();
    expect(button).not.toBeNull();
    if (button !== null) {
      await userEvent.click(button);
    }

    await waitFor(() => expect(saveTo().value).toBe('F:\\Backup'));
    expect(bridge.pickOnes()).toBe(1);
  });

  it('keeps Save to as it was on a cancel', async () => {
    bridge.setPickOne(null);
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));

    const button = browseButton();
    expect(button).not.toBeNull();
    if (button !== null) {
      await userEvent.click(button);
    }

    await waitFor(() => expect(bridge.pickOnes()).toBe(1));
    expect(saveTo().value).toBe('E:\\Movies');
  });
});
