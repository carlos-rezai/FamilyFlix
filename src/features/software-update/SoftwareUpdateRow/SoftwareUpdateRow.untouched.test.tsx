import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { fakeUpdateBridge } from '@/test-support/fakeUpdateBridge/fakeUpdateBridge';
import type { UpdateCheck } from '@/types/update';
import { SoftwareUpdateRow } from './SoftwareUpdateRow';

/**
 * 53 — Loading states, Phase 4 (issue #486): _Check for updates_ is not a
 * busy button.
 *
 * Its _Checking…_ keeps reporting the shell's update status: drawn the
 * moment the check is out, not after 300ms, with no `aria-busy`, and gone
 * the moment the check answers, with no hold.
 */

afterEach(() => {
  vi.useRealTimers();
});

const button = (name: string) =>
  screen.queryByRole('button', { name }) as HTMLButtonElement | null;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('SoftwareUpdateRow — Check for updates, off the Loader timing', () => {
  const bridge = fakeUpdateBridge();

  it('reads Checking… at once, and Check for updates the moment it answers', async () => {
    let answer: (outcome: UpdateCheck) => void = () => undefined;
    bridge.setCheck(
      new Promise<UpdateCheck>((resolve) => {
        answer = resolve;
      })
    );
    render(
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <SoftwareUpdateRow />
        </SnackbarProvider>
      </ThemeProvider>
    );
    const idle = await screen.findByRole('button', {
      name: 'Check for updates',
    });

    vi.useFakeTimers();
    fireEvent.click(idle);
    await advance(0);

    const checking = button('Checking…');
    expect(checking).not.toBeNull();
    expect(checking?.disabled).toBe(true);
    expect(checking?.getAttribute('aria-busy')).toBeNull();

    await advance(400);
    await act(async () => {
      answer('none');
    });
    await advance(0);

    expect(button('Checking…')).toBeNull();
    expect(button('Check for updates')?.disabled).toBe(false);
  });
});
