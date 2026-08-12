import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Imported through the category barrel, the way every consumer will import it
// (MovieForm, SettingsPage, ImportFlow, ExportModal) — there is no per-unit
// barrel, so this is the whole public surface.
import { Button, type ButtonProps } from '@/primitives';
import { theme } from '@/styles/theme';

function renderButton(props: Partial<ButtonProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Button label={props.label ?? 'Play'} {...props} />
    </ThemeProvider>
  );
}

describe('Button', () => {
  it('renders its label on a real button', () => {
    renderButton({ label: 'Save changes' });

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('raises the handler when clicked', () => {
    const onClick = vi.fn();
    renderButton({ label: 'Save changes', onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Button — the full spec surface', () => {
  // The four variants and two sizes differ only in fill, border, height and
  // radius — visual facts checked against `prim.Button.dc.html` by eye during
  // the build, not asserted here. What every combination owes its caller is
  // that it is still a working, correctly-labelled button.
  const variants: ButtonProps['variant'][] = [
    'primary',
    'secondary',
    'ghost',
    'danger',
  ];

  it.each(variants)('stays a working button as the %s variant', (variant) => {
    const onClick = vi.fn();
    renderButton({ label: 'Export', variant, onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['md', 'lg'] as const)('keeps its label at size %s', (size) => {
    renderButton({ label: 'Check for updates', size });

    expect(
      screen.getByRole('button', { name: 'Check for updates' })
    ).toBeTruthy();
  });

  it('is unchanged as a control when stretched to its container', () => {
    const onClick = vi.fn();
    renderButton({ label: 'Start import', fullWidth: true, onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Start import' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Button — the leading glyph', () => {
  it('draws no glyph by default', () => {
    const { container } = renderButton({ label: 'Cancel' });

    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws a glyph for icon="play"', () => {
    const { container } = renderButton({ label: 'Play', icon: 'play' });

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('keeps the glyph out of the accessible name, so the button is still "Play"', () => {
    renderButton({ label: 'Play', icon: 'play' });

    // A decorative icon that leaks into the name gives screen readers
    // "image Play" rather than "Play".
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });
});

describe('Button — disabled', () => {
  it('does not raise the handler when clicked', () => {
    const onClick = vi.fn();
    renderButton({ label: 'Finish', disabled: true, onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('is a genuinely disabled control, not one that merely looks muted', () => {
    renderButton({ label: 'Finish', disabled: true });

    // The real attribute is what takes it out of the tab order and stops the
    // browser synthesising a click from Enter or Space — swallowing the handler
    // alone would leave it keyboard-reachable and apparently live.
    const button = screen.getByRole('button', { name: 'Finish' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
