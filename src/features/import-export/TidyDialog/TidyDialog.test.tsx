import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { TidyDialog } from './TidyDialog';
import type { TidyPlan } from '@/types';
import { theme } from '@/styles/theme';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 57 — Tidy into folders, Phase 6: "the Folder row reads the plan" (issue #529).
 *
 * The **Tidy dialog** is a `Modal` titled _Tidy into folders_, the folder's
 * path beneath. On open it reads the **Tidy plan**
 * (`GET /api/library-folders/:id/loose`) and draws nothing of it until it
 * lands. Then one row per tidy: the video in mono, `→ <folder>\` and
 * _Moves with it:_ with its **Companion files** when any; and _Left where
 * they are_ with each kept file and its reason, only when anything is kept.
 *
 * The wire is a `fetch` held open until the test answers it.
 */

const wire = heldFetch();

const PATH = 'E:\\Movies';

const PLAN: TidyPlan = {
  path: PATH,
  tidies: [
    {
      id: 'apex.2026.1080p.mp4',
      kind: 'film',
      folder: 'Apex (2026)',
      videos: ['Apex.2026.1080p.mp4'],
      companions: ['Apex.2026.1080p.en.srt', 'Apex.2026.1080p-poster.jpg'],
    },
    {
      id: 'harbor.lights.2019.mp4',
      kind: 'film',
      folder: 'Harbor Lights (2019)',
      videos: ['Harbor.Lights.2019.mp4'],
      companions: [],
    },
  ],
  kept: [
    {
      files: ['Northwind (2019).mp4'],
      reason: 'A folder called “Northwind (2019)” is already here.',
      folder: 'Northwind (2019)',
    },
  ],
};

function renderDialog() {
  render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <TidyDialog open folderId="f-movies" path={PATH} onClose={vi.fn()} />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

describe('TidyDialog: reading the plan', () => {
  it('is titled Tidy into folders, the path beneath, and reads the plan on open', () => {
    renderDialog();

    expect(screen.getByText('Tidy into folders')).toBeDefined();
    expect(screen.getByText(PATH)).toBeDefined();
    expect(wire.fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/library-folders/f-movies/loose'
    );
  });

  it('draws nothing of the plan until it lands', () => {
    renderDialog();

    expect(wire.fetchMock).toHaveBeenCalled();
    expect(screen.queryByText('Apex.2026.1080p.mp4')).toBeNull();
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.queryByText('Left where they are')).toBeNull();
  });

  it('draws one row per tidy once it lands: the video in mono and → <folder>\\', async () => {
    renderDialog();

    await wire.respond(okResponse(PLAN));

    const apex = screen.getByText('Apex.2026.1080p.mp4');
    expect(getComputedStyle(apex).fontFamily).toContain('JetBrains Mono');
    expect(screen.getByText('Harbor.Lights.2019.mp4')).toBeDefined();
    expect(screen.getByText('→ Apex (2026)\\')).toBeDefined();
    expect(screen.getByText('→ Harbor Lights (2019)\\')).toBeDefined();
  });

  it('draws Moves with it: and the companions, only on a tidy with any', async () => {
    renderDialog();

    await wire.respond(okResponse(PLAN));

    expect(screen.getAllByText(/Moves with it:/)).toHaveLength(1);
    expect(
      screen.getByText(
        /Apex\.2026\.1080p\.en\.srt · Apex\.2026\.1080p-poster\.jpg/
      )
    ).toBeDefined();
  });

  it('draws Left where they are, each kept file with its reason', async () => {
    renderDialog();

    await wire.respond(okResponse(PLAN));

    expect(screen.getByText('Left where they are')).toBeDefined();
    expect(screen.getByText('Northwind (2019).mp4')).toBeDefined();
    expect(
      screen.getByText('A folder called “Northwind (2019)” is already here.')
    ).toBeDefined();
  });

  it('draws no Left where they are when nothing is kept', async () => {
    renderDialog();

    await wire.respond(okResponse({ ...PLAN, kept: [] }));

    expect(screen.getByText('Apex.2026.1080p.mp4')).toBeDefined();
    expect(screen.queryByText('Left where they are')).toBeNull();
  });
});
