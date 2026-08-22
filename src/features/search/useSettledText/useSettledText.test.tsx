import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { useSettledText } from './useSettledText';

/** How long the typing has to stop for before the value settles. */
const DEBOUNCE_MS = 250;

/**
 * Every value the hook has settled on since the test began, in order. It is the
 * only way to see how *many* times the typing was reported — “written once” is
 * the whole claim, and a listener that is told twice cannot be told apart from
 * one told once by looking at the last value alone.
 */
let settles: string[] = [];

function onSettle(value: string) {
  settles.push(value);
}

/**
 * A screen whose only control is a field driven by the hook. Nothing about the
 * host matters — the hook is the unit, and what it does is let the field keep up
 * with the typing while holding the typing back from whoever is listening.
 */
function Host({
  settled,
  onSettle: listener,
}: {
  settled: string;
  onSettle: (value: string) => void;
}) {
  const [text, setText] = useSettledText(settled, listener);

  return (
    <input
      aria-label="Field"
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

beforeEach(() => {
  settles = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderField(settled = '') {
  const view = render(<Host settled={settled} onSettle={onSettle} />);

  return {
    ...view,
    /** The settled value changing from outside, the way a URL write would. */
    resettle: (next: string) =>
      view.rerender(<Host settled={next} onSettle={onSettle} />),
  };
}

function field() {
  return screen.getByRole('textbox', { name: 'Field' }) as HTMLInputElement;
}

function type(value: string) {
  fireEvent.change(field(), { target: { value } });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useSettledText — what the field shows', () => {
  it('starts at the settled value, so a search arriving in the URL reads back', () => {
    renderField('lighthouse');

    expect(field().value).toBe('lighthouse');
  });

  it('keeps up with the typing, showing each keystroke before anything settles', () => {
    // The field must never feel like it is lagging behind the parent, so the
    // debounce holds back the listener and never the box.
    renderField();

    type('l');
    expect(field().value).toBe('l');

    type('li');
    expect(field().value).toBe('li');

    type('lig');
    expect(field().value).toBe('lig');

    expect(settles).toEqual([]);
  });

  it('resets to a settled value that changed from outside', () => {
    // Back out of a movie, or the logo home: whoever holds the settled value is
    // the authority on what the field says, including a change it didn’t cause.
    const { resettle } = renderField('comet');

    type('cometary');
    resettle('lighthouse');

    expect(field().value).toBe('lighthouse');
  });
});

describe('useSettledText — when the value settles', () => {
  it('settles nothing while the typing is still going', () => {
    renderField();

    type('lighthouse');
    wait(DEBOUNCE_MS - 1);

    expect(settles).toEqual([]);
  });

  it('settles the text once the typing has stopped', () => {
    renderField();

    type('lighthouse');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual(['lighthouse']);
  });

  it('settles once for a burst of typing, not once per keystroke', () => {
    // Ten keystrokes, one settled value — nothing downstream ever sees “l”,
    // “li” or “lig”, so no request is made for a term nobody meant.
    renderField();

    'lighthouse'.split('').forEach((_, index) => {
      type('lighthouse'.slice(0, index + 1));
      wait(50);
    });
    wait(DEBOUNCE_MS);

    expect(settles).toEqual(['lighthouse']);
  });

  it('abandons the pending settle when a new keystroke arrives', () => {
    // Not a second settle queued behind the first: the earlier term is never
    // reported at all, however long the pause before the next letter.
    renderField();

    type('comet');
    wait(DEBOUNCE_MS - 1);
    type('cometary');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual(['cometary']);
  });

  it('settles again when the typing resumes after it had settled', () => {
    renderField();

    type('comet');
    wait(DEBOUNCE_MS);
    type('comets');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual(['comet', 'comets']);
  });

  it('settles the empty string when the field is cleared', () => {
    // Clearing is a value like any other — the listener is told, so it can take
    // the search back off and bring everything back.
    renderField('lighthouse');

    type('');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual(['']);
  });

  it('settles nothing when the typing lands back on the value already settled', () => {
    // Typed and untyped again: there is nothing new to tell anyone, and an echo
    // would be a request for a query that never changed.
    renderField('comet');

    type('comets');
    type('comet');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual([]);
  });

  it('settles nothing when the settled value changes from outside', () => {
    // The field follows it, but following is not typing: reporting it back
    // would be this hook answering its own listener.
    const { resettle } = renderField('comet');

    type('cometary');
    resettle('lighthouse');
    wait(DEBOUNCE_MS);

    expect(settles).toEqual([]);
  });
});
