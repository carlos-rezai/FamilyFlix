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
