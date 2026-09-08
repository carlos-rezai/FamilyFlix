import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — the path MovieForm imports it by.
import { Textarea, type TextareaProps } from '@/primitives';
import { theme } from '@/styles/theme';

function renderTextarea(props: Partial<TextareaProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Textarea
        value=""
        aria-label="Description"
        onChange={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

/** The one control on screen — found the way a parent finds it, by its name. */
function area(name = 'Description') {
  return screen.getByRole('textbox', { name }) as HTMLTextAreaElement;
}

/**
 * The multi-line field from `prim.Textarea.dc.html` — `TextField`'s counterpart
 * for the one value on the **Movie form** that is a paragraph rather than a
 * line, and the reason a synopsis is not typed into a single-line box.
 *
 * It is the same bargain every primitive here makes: it draws the value it is
 * handed and says what was typed, and knows nothing about a movie.
 */
describe('Textarea', () => {
  it('renders the value it is given', () => {
    renderTextarea({ value: 'A photographer watches his neighbours.' });

    expect(area().value).toBe('A photographer watches his neighbours.');
  });

  it('reports what was typed as the new value, not the event', () => {
    // Every caller wants the string. The primitive unwraps the event once here
    // rather than at each call site, exactly as `TextField` does.
    const onChange = vi.fn();
    renderTextarea({ onChange });

    fireEvent.change(area(), { target: { value: 'A short synopsis' } });

    expect(onChange).toHaveBeenCalledWith('A short synopsis');
  });

  it('shows the placeholder it is given', () => {
    renderTextarea({ placeholder: 'A short synopsis of the movie' });

    expect(area().placeholder).toBe('A short synopsis of the movie');
  });

  it('is named by the label it is given, so the field announces as itself', () => {
    renderTextarea({ 'aria-label': 'Description' });

    expect(area('Description')).toBeDefined();
  });

  it('is a real textarea, so a synopsis is typed on more than one line', () => {
    // The whole reason this primitive exists rather than another `TextField`:
    // the value that lands in it is a paragraph, and an `<input>` can only ever
    // show one line of it.
    renderTextarea();

    expect(area().tagName).toBe('TEXTAREA');
  });

  it('keeps a typed newline, rather than flattening it to a line', () => {
    const onChange = vi.fn();
    renderTextarea({ onChange });

    fireEvent.change(area(), { target: { value: 'One line.\nAnother.' } });

    expect(onChange).toHaveBeenCalledWith('One line.\nAnother.');
  });
});

describe('Textarea — its box', () => {
  it('opens at the prototype’s 96px, so it reads as a paragraph before one is typed', () => {
    // `prim.Textarea.dc.html`'s own `minHeight` default. The prop it declares
    // around that value is deliberately not built: nothing passes a non-default
    // yet, which is the same call `TextField`'s styles file made for `height`.
    renderTextarea();

    expect(getComputedStyle(area()).minHeight).toBe('96px');
  });

  it('can still be dragged taller, the way the prototype allows', () => {
    renderTextarea();

    expect(getComputedStyle(area()).resize).toBe('vertical');
  });
});
