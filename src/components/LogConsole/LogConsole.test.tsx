import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LogConsole, type LogConsoleProps } from '@/components';
import { theme } from '@/styles/theme';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';
import type { LogKind, LogLine } from '@/types';

/**
 * 13 — Bulk import, Phase 3: "the console" (issue #128).
 *
 * The **Activity log**'s box, from `mol.LogConsole.dc.html`: mono lines, each
 * coloured by its **Log kind**, in a scrolling box that follows the newest
 * line — the installer-style console the running step reads the run from.
 * The parent caps the buffer; the box only draws what it is handed.
 *
 * The box is an ARIA `log`: a region whose new lines arrive in order, which
 * is exactly what the role names.
 */

const line = (text: string, kind: LogKind = 'info'): LogLine => ({
  text,
  kind,
});

function renderConsole(props: Partial<LogConsoleProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LogConsole lines={props.lines ?? []} {...props} />
    </ThemeProvider>
  );
}

const consoleBox = () => screen.getByRole('log');

/** The token each kind is inked in, as jsdom reports the hex. */
const INK: Record<LogKind, string> = {
  success: 'rgb(138, 154, 107)', // `success`
  warning: 'rgb(224, 167, 85)', // `warning`
  error: 'rgb(201, 122, 106)', // `danger`
  scan: 'rgb(182, 169, 148)', // `text-dim`
  path: 'rgb(133, 122, 104)', // `text-faint`
  info: 'rgb(133, 122, 104)', // `text-faint`
};

describe('LogConsole — the lines', () => {
  it('shows every line it is handed, in order', () => {
    renderConsole({
      lines: [
        line('Connecting to D:\\Movies …'),
        line('Scanning  Drama/Amelie (2001)', 'scan'),
        line('✓ Imported  Amélie', 'success'),
      ],
    });

    const shown = [
      'Connecting to D:\\Movies …',
      'Scanning  Drama/Amelie (2001)',
      '✓ Imported  Amélie',
    ].map((text) => screen.getByText(text));
    expect(shown).toHaveLength(3);
    expect(
      shown[0].compareDocumentPosition(shown[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      shown[1].compareDocumentPosition(shown[2]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows nothing but the box when there is no line yet', () => {
    renderConsole({ lines: [] });

    expect(consoleBox().textContent).toBe('');
  });

  it('sets the lines in mono', () => {
    renderConsole({ lines: [line('Connecting to D:\\Movies …')] });

    expect(
      getComputedStyle(screen.getByText('Connecting to D:\\Movies …'))
        .fontFamily
    ).toContain('JetBrains Mono');
  });
});

describe('LogConsole — colours each kind', () => {
  it.each(Object.keys(INK) as LogKind[])(
    'inks a %s line in its token',
    (kind) => {
      renderConsole({ lines: [line(`a ${kind} line`, kind)] });

      expect(getComputedStyle(screen.getByText(`a ${kind} line`)).color).toBe(
        INK[kind]
      );
    }
  );

  it('inks each line by its own kind, not its neighbours', () => {
    renderConsole({
      lines: [
        line('✓ Imported  Die Hard', 'success'),
        line('⚠ Amélie — no subtitle track found', 'warning'),
        line('✗ The copy failed', 'error'),
      ],
    });

    expect(
      getComputedStyle(screen.getByText('✓ Imported  Die Hard')).color
    ).toBe(INK.success);
    expect(
      getComputedStyle(screen.getByText('⚠ Amélie — no subtitle track found'))
        .color
    ).toBe(INK.warning);
    expect(getComputedStyle(screen.getByText('✗ The copy failed')).color).toBe(
      INK.error
    );
  });
});

describe('LogConsole — pinned to the bottom', () => {
  // A box taller than its 220 with eighty lines in it: the only way jsdom
  // can be made to have anything to scroll.
  const CONTENT_HEIGHT = 1650;
  stubScrollMetrics(CONTENT_HEIGHT);

  const eighty = Array.from({ length: 80 }, (_, n) =>
    line(`Scanning  Film ${String(n + 1).padStart(3, '0')}`, 'scan')
  );

  it('opens at the newest line', () => {
    renderConsole({ lines: eighty });

    expect(consoleBox().scrollTop).toBe(CONTENT_HEIGHT);
  });

  it('follows to the bottom when a line arrives', () => {
    const { rerender } = renderConsole({ lines: eighty });
    // The box has been somewhere else — a shorter log, an earlier layout.
    consoleBox().scrollTop = 300;

    rerender(
      <ThemeProvider theme={theme}>
        <LogConsole
          lines={[...eighty, line('✓ Imported  Amélie', 'success')]}
        />
      </ThemeProvider>
    );

    expect(consoleBox().scrollTop).toBe(CONTENT_HEIGHT);
  });
});
