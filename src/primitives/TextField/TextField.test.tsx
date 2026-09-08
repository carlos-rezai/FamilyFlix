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

/** The box the field is drawn as — the input's own wrapper. */
function box(name = 'Search your movies') {
  return field(name).parentElement as HTMLElement;
}

/**
 * The two props `prim.TextField.dc.html` declares and this primitive has been
 * carrying an explanation for rather than an implementation of: "their
 * non-default values arrive with MovieForm and ImportFlow". **MovieForm is that
 * caller** — its metadata fields are the prototype's 48px box with a soft
 * corner, not the 46px pill the search bar wears.
 *
 * Both defaults are asserted beside their non-defaults, because the whole risk
 * of growing a shipped primitive is the caller that never asked for either:
 * `SearchBar` passes neither prop and must be drawn today exactly as it was
 * before these existed.
 */
describe('TextField — its height', () => {
  it('is the prototype’s 46px when nothing is asked for', () => {
    renderTextField();

    expect(getComputedStyle(box()).height).toBe('46px');
  });

  it('is whatever height it is given', () => {
    // 48 is the value the **Movie form** asks for, from the prototype's own
    // `inputStyle`.
    renderTextField({ height: 48 });

    expect(getComputedStyle(box()).height).toBe('48px');
  });
});

describe('TextField — its corners', () => {
  it('is a pill when nothing is asked for', () => {
    renderTextField();

    expect(getComputedStyle(box()).borderRadius).toBe(theme.radius.pill);
  });

  it('takes the soft corner the form’s fields wear when asked not to be a pill', () => {
    // The one deliberate deviation from the prototype in this slice: its inline
    // `10px` becomes `radius.md` (12px), because COMPONENT-SPEC §1 says every
    // visual value is a token and 10 is not one. Asserted as the token rather
    // than as `'12px'`, so the rule is what is under test.
    renderTextField({ rounded: false });

    expect(getComputedStyle(box()).borderRadius).toBe(theme.radius.md);
  });

  it('is a pill again when explicitly asked to be one', () => {
    renderTextField({ rounded: true });

    expect(getComputedStyle(box()).borderRadius).toBe(theme.radius.pill);
  });

  it('takes a height and a corner together, the way the form asks for them', () => {
    renderTextField({ height: 48, rounded: false });

    expect(getComputedStyle(box()).height).toBe('48px');
    expect(getComputedStyle(box()).borderRadius).toBe(theme.radius.md);
  });

  it('leaves an icon-led field drawn exactly as it was', () => {
    // `SearchBar` passes neither prop. A primitive that grew two props and
    // moved the one screen already built on it would be the failure this test
    // exists to catch.
    renderTextField({ icon: <SearchIcon size={18} /> });

    expect(getComputedStyle(box()).height).toBe('46px');
    expect(getComputedStyle(box()).borderRadius).toBe(theme.radius.pill);
  });
});
