import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import {
  IDLE_STATUS,
  fakeUpdateBridge,
} from '@/test-support/fakeUpdateBridge/fakeUpdateBridge';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import type { UpdateStatus } from '@/types/update';
import { readSeenVersion, writeSeenVersion } from '../seenVersion/seenVersion';
import { SoftwareUpdateNotice } from './SoftwareUpdateNotice';

/**
 * 17 — Software update, Phase 3: "the offer snackbar and the congratulation"
 * (issue #238).
 *
 * The family's surface: headless, mounted once in `App` inside the
 * `SnackbarProvider`, and inert with no bridge. It pushes the **Update offer
 * snackbar** — info, _Update available_, `FamilyFlix <v> is ready to
 * install.`, **Update now** → `install()` — once per renderer load, whether
 * the offer was there when `current()` landed or arrived on `onStatus`, and
 * never twice under StrictMode. A status that turns `installing` retracts it.
 * And on the first load after the **Seen version** changed, it says
 * `FamilyFlix updated to <v>.` — never on a fresh install.
 */

const OFFERED: UpdateStatus = {
  offered: '1.1.0',
  lastCheckedAt: null,
  installing: false,
};

const INSTALLING: UpdateStatus = { ...OFFERED, installing: true };

const OFFER_MESSAGE = 'FamilyFlix 1.1.0 is ready to install.';

function renderNotice(strict = false) {
  const tree: ReactNode = (
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <SoftwareUpdateNotice />
      </SnackbarProvider>
    </ThemeProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/** Let every pending read and effect settle. */
const settle = () => act(async () => undefined);

const offers = () => within(snackbarStack()).queryAllByText(OFFER_MESSAGE);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('SoftwareUpdateNotice — with no bridge', () => {
  it('pushes nothing', async () => {
    renderNotice();
    await settle();

    expect(within(snackbarStack()).queryByRole('status')).toBeNull();
    expect(within(snackbarStack()).queryByRole('alert')).toBeNull();
  });

  it('pushes no congratulation either, even over a changed Seen version', async () => {
    writeSeenVersion(`${__APP_VERSION__}-before`);

    renderNotice();
    await settle();

    expect(
      screen.queryByText(`FamilyFlix updated to ${__APP_VERSION__}.`)
    ).toBeNull();
  });
});

describe('SoftwareUpdateNotice — the offer', () => {
  const bridge = fakeUpdateBridge();

  it('pushes the offer when current() lands with one', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice();

    const notice = await within(snackbarStack()).findByRole('status');
    expect(within(notice).getByText('Update available')).toBeTruthy();
    expect(within(notice).getByText(OFFER_MESSAGE)).toBeTruthy();
    expect(
      within(notice).getByRole('button', { name: 'Update now' })
    ).toBeTruthy();
  });

  it('pushes the offer when the first onStatus brings one', async () => {
    renderNotice();
    await settle();
    expect(offers()).toHaveLength(0);

    act(() => bridge.emit(OFFERED));

    expect(
      await within(snackbarStack()).findByText(OFFER_MESSAGE)
    ).toBeTruthy();
  });

  it('pushes it once, however many statuses carry the offer', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice();
    await within(snackbarStack()).findByText(OFFER_MESSAGE);

    act(() => bridge.emit(OFFERED));
    act(() =>
      bridge.emit({ ...OFFERED, lastCheckedAt: new Date().toISOString() })
    );
    await settle();

    expect(offers()).toHaveLength(1);
  });

  it('pushes it once under StrictMode', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice(true);
    await within(snackbarStack()).findByText(OFFER_MESSAGE);

    act(() => bridge.emit(OFFERED));
    await settle();

    expect(offers()).toHaveLength(1);
  });

  it('pushes it once under StrictMode when it arrives on onStatus', async () => {
    renderNotice(true);
    await settle();

    act(() => bridge.emit(OFFERED));
    await within(snackbarStack()).findByText(OFFER_MESSAGE);
    act(() => bridge.emit(OFFERED));
    await settle();

    expect(offers()).toHaveLength(1);
  });

  it('pushes nothing while there is no offer', async () => {
    renderNotice();
    await settle();
    act(() => bridge.emit(IDLE_STATUS));
    await settle();

    expect(offers()).toHaveLength(0);
  });

  it('persists — no timer takes it away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bridge.setCurrent(OFFERED);
    renderNotice();
    await within(snackbarStack()).findByText(OFFER_MESSAGE);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(offers()).toHaveLength(1);
  });

  it('Update now calls install()', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice();
    const notice = await within(snackbarStack()).findByRole('status');

    await userEvent.click(
      within(notice).getByRole('button', { name: 'Update now' })
    );

    expect(bridge.installs()).toBe(1);
  });

  it('retracts the offer when a status arrives installing', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice();
    await within(snackbarStack()).findByText(OFFER_MESSAGE);

    act(() => bridge.emit(INSTALLING));
    await settle();

    expect(offers()).toHaveLength(0);
  });

  it('retracts it under StrictMode too', async () => {
    bridge.setCurrent(OFFERED);
    renderNotice(true);
    await within(snackbarStack()).findByText(OFFER_MESSAGE);

    act(() => bridge.emit(INSTALLING));
    await settle();

    expect(offers()).toHaveLength(0);
  });
});

describe('SoftwareUpdateNotice — the congratulation', () => {
  fakeUpdateBridge();

  const CONGRATULATION = `FamilyFlix updated to ${__APP_VERSION__}.`;

  it('shows a success when the Seen version has changed', async () => {
    writeSeenVersion(`${__APP_VERSION__}-before`);

    renderNotice();

    const notice = await within(snackbarStack()).findByRole('status');
    expect(within(notice).getByText(CONGRATULATION)).toBeTruthy();
  });

  it('leaves the running version as the Seen version afterwards', async () => {
    writeSeenVersion(`${__APP_VERSION__}-before`);

    renderNotice();
    await within(snackbarStack()).findByText(CONGRATULATION);

    expect(readSeenVersion()).toBe(__APP_VERSION__);
  });

  it('shows it once under StrictMode', async () => {
    writeSeenVersion(`${__APP_VERSION__}-before`);

    renderNotice(true);
    await within(snackbarStack()).findByText(CONGRATULATION);
    await settle();

    expect(within(snackbarStack()).getAllByText(CONGRATULATION)).toHaveLength(
      1
    );
  });

  it('shows nothing on a fresh install, and records the running version', async () => {
    renderNotice();
    await settle();

    expect(screen.queryByText(CONGRATULATION)).toBeNull();
    expect(readSeenVersion()).toBe(__APP_VERSION__);
  });

  it('shows nothing when the Seen version is the running one', async () => {
    writeSeenVersion(__APP_VERSION__);

    renderNotice();
    await settle();

    expect(screen.queryByText(CONGRATULATION)).toBeNull();
    expect(readSeenVersion()).toBe(__APP_VERSION__);
  });
});
