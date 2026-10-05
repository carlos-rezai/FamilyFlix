import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeUpdateBridge } from '@/test-support/fakeUpdateBridge/fakeUpdateBridge';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import type { UpdateCheck } from '@/types/update';
import { SoftwareUpdateRow } from './SoftwareUpdateRow';

/**
 * 17 — Software update, Phase 1: "the bridge and the row" (issue #236).
 *
 * The About card's first row, from `page.SettingsPage.dc.html`: the
 * UploadIcon tile, _Software update_, the line and one `Button size="md"`,
 * with the full-bleed hairline under it. It reads the bridge the preload
 * defines; with none — a browser — it draws nothing, hairline included, so
 * the card is exactly today's.
 *
 * A press of **Check for updates** shows _Checking…_ for the life of the
 * check, then answers through `useSnackbar()` under the real
 * `SnackbarProvider`: `none` a success, `refused` an error, `unavailable` an
 * info, and `found` nothing — the offer follows on its own.
 */

function renderRow() {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <SoftwareUpdateRow />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

/** A token as jsdom reports it back. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The full-bleed hairline: the one 1px-tall rule — reached by its geometry. */
const hairlines = (): Element[] =>
  Array.from(document.body.querySelectorAll('div')).filter(
    (node) => getComputedStyle(node).height === '1px'
  );

/** The notice's accent bar: the one 4px-wide thing in it. */
function accentColour(notice: HTMLElement): string {
  const bar = Array.from(notice.querySelectorAll('*')).find(
    (node) => getComputedStyle(node).width === '4px'
  );
  return bar === undefined ? '' : getComputedStyle(bar).backgroundColor;
}

/** A check held open until the test answers it. */
function heldCheck() {
  let answer: (outcome: UpdateCheck) => void = () => undefined;
  const pending = new Promise<UpdateCheck>((resolve) => {
    answer = resolve;
  });
  return {
    pending,
    answer: (outcome: UpdateCheck) => act(() => answer(outcome)),
  };
}

const checkButton = () =>
  screen.findByRole('button', { name: 'Check for updates' });

describe('SoftwareUpdateRow — with no bridge', () => {
  it('draws nothing', () => {
    renderRow();

    expect(screen.queryByText('Software update')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes its hairline with it', () => {
    renderRow();

    expect(hairlines()).toHaveLength(0);
  });
});

describe('SoftwareUpdateRow — idle', () => {
  fakeUpdateBridge();

  it('draws the title, the up-to-date line and Check for updates', async () => {
    renderRow();

    expect(await screen.findByText('Software update')).toBeDefined();
    expect(screen.getByText(/You.re up to date\./)).toBeDefined();
    const button = await checkButton();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('draws the line under the title, and the button after both', async () => {
    renderRow();

    const title = await screen.findByText('Software update');
    const line = screen.getByText(/You.re up to date\./);
    expect(comesBefore(title, line)).toBe(true);
    expect(comesBefore(line, await checkButton())).toBe(true);
  });

  it('draws the full-bleed hairline under the row', async () => {
    renderRow();

    const button = await checkButton();
    const rules = hairlines();
    expect(rules).toHaveLength(1);
    expect(comesBefore(button, rules[0] as HTMLElement)).toBe(true);
  });
});

describe('SoftwareUpdateRow — checking', () => {
  const bridge = fakeUpdateBridge();

  it('shows a disabled Checking… for the life of the check', async () => {
    const held = heldCheck();
    bridge.setCheck(held.pending);
    renderRow();

    await userEvent.click(await checkButton());

    const checking = await screen.findByRole('button', { name: 'Checking…' });
    expect((checking as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/You.re up to date\./)).toBeDefined();

    await held.answer('none');

    const again = await checkButton();
    expect((again as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Checking…' })).toBeNull();
  });

  it('asks the bridge once per press', async () => {
    renderRow();

    await userEvent.click(await checkButton());

    await waitFor(() => expect(bridge.checks()).toBe(1));
  });
});

describe('SoftwareUpdateRow — the answers to a press', () => {
  const bridge = fakeUpdateBridge();

  it("answers none with a success: You're on the latest version.", async () => {
    bridge.setCheck('none');
    renderRow();

    await userEvent.click(await checkButton());

    const notice = await within(snackbarStack()).findByRole('status');
    expect(
      within(notice).getByText(/^You.re on the latest version\.$/)
    ).toBeDefined();
    expect(accentColour(notice)).toBe(rgb(theme.colors.success));
  });

  it("answers refused with an error: FamilyFlix couldn't check for updates.", async () => {
    bridge.setCheck('refused');
    renderRow();

    await userEvent.click(await checkButton());

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(
      within(notice).getByText(/^FamilyFlix couldn.t check for updates\.$/)
    ).toBeDefined();
    expect(accentColour(notice)).toBe(rgb(theme.colors.danger));
  });

  it('answers unavailable with an info: Updates are only available in the installed app.', async () => {
    bridge.setCheck('unavailable');
    renderRow();

    await userEvent.click(await checkButton());

    const notice = await within(snackbarStack()).findByRole('status');
    expect(
      within(notice).getByText(
        'Updates are only available in the installed app.'
      )
    ).toBeDefined();
    expect(accentColour(notice)).toBe(rgb(theme.colors.info));
  });

  it('answers found with nothing — the offer follows on its own', async () => {
    const held = heldCheck();
    bridge.setCheck(held.pending);
    renderRow();

    await userEvent.click(await checkButton());
    await screen.findByRole('button', { name: 'Checking…' });
    await held.answer('found');
    await checkButton();

    expect(within(snackbarStack()).queryByRole('status')).toBeNull();
    expect(within(snackbarStack()).queryByRole('alert')).toBeNull();
  });
});

/**
 * 17 — Software update, Phase 2: "offered and installing on the row"
 * (issue #237).
 *
 * The row draws whatever main last pushed. An **Update offer** draws the
 * **Offered version** in the accent over **Update now**, whether it was there
 * when the row mounted or arrived while it was on screen; a press calls
 * `install()`. _Installing and restarting…_ over a disabled `Updating…` comes
 * from a pushed `installing`, never from the row's own press — so an install
 * started from the offer snackbar draws the same face.
 */

const OFFERED = {
  offered: '0.2.0',
  lastCheckedAt: null,
  installing: false,
} as const;
const INSTALLING = { ...OFFERED, installing: true } as const;

const updateNow = () => screen.findByRole('button', { name: 'Update now' });

describe('SoftwareUpdateRow — offered', () => {
  const bridge = fakeUpdateBridge();

  it('draws the offered face when the offer is already there on mount', async () => {
    bridge.setCurrent(OFFERED);
    renderRow();

    const button = await updateNow();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(
      screen.getByText('Version 0.2.0 is available to install.')
    ).toBeDefined();
  });

  it('draws the offered face when the offer is pushed while it is on screen', async () => {
    renderRow();
    await checkButton();

    act(() => bridge.emit(OFFERED));

    expect(await updateNow()).toBeDefined();
    expect(
      screen.getByText('Version 0.2.0 is available to install.')
    ).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Check for updates' })
    ).toBeNull();
  });

  it('draws the offered version in the accent', async () => {
    bridge.setCurrent(OFFERED);
    renderRow();

    await updateNow();
    const line = screen.getByText('Version 0.2.0 is available to install.');
    expect(getComputedStyle(line).color).toBe(rgb(theme.colors.accent));
  });

  it('Update now calls install()', async () => {
    bridge.setCurrent(OFFERED);
    renderRow();

    await userEvent.click(await updateNow());

    expect(bridge.installs()).toBe(1);
    expect(bridge.checks()).toBe(0);
  });
});

describe('SoftwareUpdateRow — installing', () => {
  const bridge = fakeUpdateBridge();

  it('draws Installing and restarting… over a disabled Updating… from a pushed installing', async () => {
    bridge.setCurrent(OFFERED);
    renderRow();
    await updateNow();

    act(() => bridge.emit(INSTALLING));

    const button = await screen.findByRole('button', { name: 'Updating…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Installing and restarting…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull();
  });

  it('draws the installing face from the push alone, not from its own press', async () => {
    bridge.setCurrent(OFFERED);
    renderRow();

    await userEvent.click(await updateNow());

    expect(bridge.installs()).toBe(1);
    expect(screen.queryByText('Installing and restarting…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Updating…' })).toBeNull();
  });

  it('draws the installing face for an install started elsewhere', async () => {
    renderRow();
    await checkButton();

    act(() => bridge.emit(INSTALLING));

    expect(await screen.findByText('Installing and restarting…')).toBeDefined();
    expect(bridge.installs()).toBe(0);
  });

  it('draws the installing face when it is already installing on mount', async () => {
    bridge.setCurrent(INSTALLING);
    renderRow();

    const button = await screen.findByRole('button', { name: 'Updating…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('SoftwareUpdateRow — a status pushed while mounted', () => {
  const bridge = fakeUpdateBridge();

  it('redraws when a launch check answers while Settings is open', async () => {
    renderRow();
    await checkButton();
    expect(screen.queryByText(/Last checked/)).toBeNull();

    act(() =>
      bridge.emit({
        offered: null,
        lastCheckedAt: new Date().toISOString(),
        installing: false,
      })
    );

    expect(await screen.findByText(/Last checked just now/)).toBeDefined();
  });
});
