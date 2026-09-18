import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Imported through the category barrel, the way its consumer will import it
// (PlaybackSection) — there is no per-unit barrel, so this is the whole
// public surface.
import { Toggle, type ToggleProps } from '@/primitives';
import { theme } from '@/styles/theme';

/**
 * 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144).
 *
 * The switch atom from `prim.Toggle.dc.html`, per COMPONENT-SPEC:
 * `{ checked, disabled?, onToggle, label }`. A `role="switch"` button carrying
 * `aria-checked` and `aria-disabled` rather than the `disabled` attribute — it
 * stays in the tab order and announces itself as a disabled switch rather
 * than being skipped. 46×26 on a 3px pad, opacity `.45` and `not-allowed`
 * when disabled, `onToggle` on press and on Space / Enter and never when
 * disabled. `label` is the accessible name the prototype's bare button lacks.
 *
 * Its one caller today draws it `checked={false} disabled` beside the
 * **Coming soon** pill; it stores nothing.
 */

function renderToggle(props: Partial<ToggleProps> = {}) {
  const onToggle = props.onToggle ?? vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <Toggle
        checked={props.checked ?? false}
        label={props.label ?? 'Turn on automatically'}
        {...props}
        onToggle={onToggle}
      />
    </ThemeProvider>
  );
  return { onToggle };
}

const toggle = (name = 'Turn on automatically') =>
  screen.getByRole('switch', { name });

describe('Toggle — what it announces', () => {
  it('is a switch named by its label, on a real button', () => {
    renderToggle({ label: 'Show subtitles' });

    const control = toggle('Show subtitles');
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('type')).toBe('button');
  });

  it('is checked when told so', () => {
    renderToggle({ checked: true });

    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('is unchecked when told so', () => {
    renderToggle({ checked: false });

    expect(toggle().getAttribute('aria-checked')).toBe('false');
  });

  it('is not disabled unless told so', () => {
    renderToggle();

    expect(toggle().getAttribute('aria-disabled')).not.toBe('true');
    expect(toggle().hasAttribute('disabled')).toBe(false);
  });

  it('announces itself as disabled rather than being skipped', () => {
    renderToggle({ disabled: true });

    const control = toggle();
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.hasAttribute('disabled')).toBe(false);
  });

  it('draws the knob as decoration, not as text', () => {
    renderToggle();

    expect(toggle().textContent).toBe('');
  });
});

describe('Toggle — what a press does', () => {
  it('raises onToggle when pressed', () => {
    const { onToggle } = renderToggle();

    fireEvent.click(toggle());

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('raises onToggle on Space', () => {
    const { onToggle } = renderToggle();

    fireEvent.keyDown(toggle(), { key: ' ' });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('raises onToggle on Enter', () => {
    const { onToggle } = renderToggle();

    fireEvent.keyDown(toggle(), { key: 'Enter' });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('ignores every other key', () => {
    const { onToggle } = renderToggle();

    fireEvent.keyDown(toggle(), { key: 'ArrowRight' });
    fireEvent.keyDown(toggle(), { key: 'Escape' });
    fireEvent.keyDown(toggle(), { key: 'a' });

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('leaves the state to its owner — a press changes nothing on its own', () => {
    renderToggle({ checked: false });

    fireEvent.click(toggle());

    expect(toggle().getAttribute('aria-checked')).toBe('false');
  });
});

describe('Toggle — disabled', () => {
  it('calls nothing when pressed', () => {
    const { onToggle } = renderToggle({ disabled: true });

    fireEvent.click(toggle());

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('calls nothing on Space or Enter', () => {
    const { onToggle } = renderToggle({ disabled: true });

    fireEvent.keyDown(toggle(), { key: ' ' });
    fireEvent.keyDown(toggle(), { key: 'Enter' });

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('can still take focus — it stays in the tab order', () => {
    renderToggle({ disabled: true });

    toggle().focus();

    expect(document.activeElement).toBe(toggle());
  });
});

describe('Toggle — the prototype’s pixels', () => {
  it('is 46 by 26', () => {
    renderToggle();

    const style = getComputedStyle(toggle());
    expect(style.width).toBe('46px');
    expect(style.height).toBe('26px');
  });

  it('draws at full opacity under a pointer when enabled', () => {
    renderToggle();

    const style = getComputedStyle(toggle());
    expect(style.opacity).toBe('1');
    expect(style.cursor).toBe('pointer');
  });

  it('fades to .45 under not-allowed when disabled', () => {
    renderToggle({ disabled: true });

    const style = getComputedStyle(toggle());
    expect(style.opacity).toBe('0.45');
    expect(style.cursor).toBe('not-allowed');
  });
});
