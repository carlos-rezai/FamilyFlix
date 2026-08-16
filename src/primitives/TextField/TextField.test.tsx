import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — the path SearchBar imports it by.
import { TextField, SearchIcon, type TextFieldProps } from '@/primitives';
import { theme } from '@/styles/theme';

function renderTextField(props: Partial<TextFieldProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <TextField
        value=""
        aria-label="Search your movies"
        onChange={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

/** The one control on screen — found the way a parent finds it, by its name. */
function field(name = 'Search your movies') {
  return screen.getByRole('textbox', { name }) as HTMLInputElement;
}

describe('TextField', () => {
  it('renders the value it is given', () => {
    renderTextField({ value: 'lighthouse' });

    expect(field().value).toBe('lighthouse');
  });

  it('reports what was typed as the new value, not the event', () => {
    // Every caller wants the string. The primitive unwraps the event once here
    // rather than at each call site.
    const onChange = vi.fn();
    renderTextField({ onChange });

    fireEvent.change(field(), { target: { value: 'light' } });

    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('is named by the label it is given, so the field announces as itself', () => {
    // An icon-led field has no visible caption; without this it announces as
    // "edit text" and nothing else.
    renderTextField({ 'aria-label': 'Search your movies' });

    expect(field('Search your movies').tagName).toBe('INPUT');
  });

  it('shows the placeholder it is given', () => {
    renderTextField({ placeholder: 'Search your movies' });

    expect(field().placeholder).toBe('Search your movies');
  });
});

describe('TextField — the icon slot', () => {
  it('draws the icon it is handed', () => {
    // A slot, not the prototype's `icon` enum: COMPONENT-SPEC §3a lifts each
    // inlined glyph into its own component, so a new icon never widens this.
    const { container } = renderTextField({ icon: <SearchIcon size={18} /> });

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('keeps the icon decorative, out of the accessible name', () => {
    renderTextField({
      icon: <SearchIcon size={18} />,
      'aria-label': 'Search your movies',
    });

    // The glyph is chrome. It announces nothing of its own, and the field is
    // still named by its label alone.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(field('Search your movies')).toBeDefined();
  });

  it('draws no icon when none is given', () => {
    const { container } = renderTextField();

    expect(container.querySelector('svg')).toBeNull();
  });
});
