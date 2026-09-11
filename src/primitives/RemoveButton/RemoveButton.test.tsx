import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — the path FileField and SubtitleRow import it by.
import { RemoveButton, type RemoveButtonProps } from '@/primitives';
import { theme } from '@/styles/theme';

function renderRemoveButton(props: Partial<RemoveButtonProps> = {}) {
  const onClick = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <RemoveButton
        removes={props.removes ?? 'Video'}
        onClick={props.onClick ?? onClick}
      />
    </ThemeProvider>
  );

  return { onClick };
}

/**
 * The ✕ — the one destructive control on the **Movie form**, drawn once for
 * an emptied **File slot** and once for a removed **Subtitle row**. It owns a
 * name and a title built from what it removes, and the glyph; what the press
 * takes away is the caller's business.
 */
describe('RemoveButton', () => {
  it('is a real button', () => {
    renderRemoveButton();

    const button = screen.getByRole('button', { name: 'Remove Video' });
    expect(button.tagName).toBe('BUTTON');
    // Inside a form, a bare <button> would submit it.
    expect(button.getAttribute('type')).toBe('button');
  });

  it('is named after what it removes', () => {
    renderRemoveButton({ removes: 'lantern_keeper.en.srt' });

    // A column of these reads as a column of identical ✕s to anything that
    // cannot see the row, which is why the accessible name carries the thing.
    expect(
      screen.getByRole('button', { name: 'Remove lantern_keeper.en.srt' })
    ).toBeDefined();
  });

  it('carries the same name as its tooltip', () => {
    renderRemoveButton({ removes: 'Poster' });

    expect(
      screen
        .getByRole('button', { name: 'Remove Poster' })
        .getAttribute('title')
    ).toBe('Remove Poster');
  });

  it('draws the ✕ glyph', () => {
    renderRemoveButton();

    expect(
      screen.getByRole('button', { name: 'Remove Video' }).textContent
    ).toBe('✕');
  });

  it('raises the handler when pressed', () => {
    const { onClick } = renderRemoveButton();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Video' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
