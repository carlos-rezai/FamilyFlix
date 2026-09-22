import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { FilterDropdown, type FilterDropdownProps } from '@/components';
import type { FilterOption } from '@/types';
import { theme } from '@/styles/theme';

/**
 * The simplest list that exercises every shape a `FilterOption` comes in: the
 * current selection, a counted row, and a row with no count at all.
 */
function genreOptions(onSelect: () => void = () => undefined): FilterOption[] {
  return [
    {
      label: 'All Genres',
      count: 24,
      selected: true,
      onSelect: () => undefined,
    },
    { label: 'Drama', count: 6, selected: false, onSelect },
    { label: 'Comedy', selected: false, onSelect: () => undefined },
  ];
}

function renderDropdown(props: Partial<FilterDropdownProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <FilterDropdown
        label="Genre"
        value="All Genres"
        options={genreOptions()}
        {...props}
      />
    </ThemeProvider>
  );
}

/** The pill, found by the name a screen reader announces for it. */
const pill = (name = 'Genre: All Genres') =>
  screen.getByRole('button', { name });

/** One row of the open panel. */
const option = (name: string) => screen.getByRole('menuitem', { name });
const noOption = (name: string) => screen.queryByRole('menuitem', { name });

/** Opens it the way a keyboard user does — focus the pill, then act. */
function openDropdown(name?: string) {
  const control = pill(name);
  control.focus();
  fireEvent.click(control);
  return control;
}

describe('FilterDropdown — the pill', () => {
  it('shows the current value when it is shut', () => {
    renderDropdown({ value: 'Drama' });

    expect(pill('Genre: Drama').textContent).toContain('Drama');
  });

  it('lists nothing until it is opened', () => {
    renderDropdown();

    expect(noOption('Comedy')).toBeNull();
  });

  it('shows the label beside the value by default', () => {
    renderDropdown();

    expect(pill().textContent).toContain('Genre');
  });

  it('draws the prototype’s chevron, which announces nothing', () => {
    renderDropdown();

    // In the name, "Genre: All Genres" — on screen, a ▾ as well.
    expect(pill().textContent).toContain('▾');
  });

  it('says what it opens and whether it is open', () => {
    renderDropdown();

    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    expect(pill().getAttribute('aria-expanded')).toBe('false');

    openDropdown();

    expect(pill().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('FilterDropdown — naming itself', () => {
  it('announces the label with the value, so no caller can ship it unnamed', () => {
    // The dropdown takes no `aria-label` prop: `label` is required and always
    // forms the name, which is what stops a caller from forgetting it.
    renderDropdown();

    expect(pill('Genre: All Genres')).toBeTruthy();
  });

  it('keeps the label in the name when it is hidden from view', () => {
    renderDropdown({
      label: 'Minimum rating',
      value: '3+ stars',
      showLabel: false,
    });

    expect(pill('Minimum rating: 3+ stars')).toBeTruthy();
  });

  it('hides the caption itself when asked', () => {
    renderDropdown({
      label: 'Minimum rating',
      value: '3+ stars',
      showLabel: false,
    });

    expect(pill('Minimum rating: 3+ stars').textContent).not.toContain(
      'Minimum rating'
    );
  });
});

describe('FilterDropdown — the leading star', () => {
  it('wears the star in the caption’s place when asked', () => {
    renderDropdown({
      label: 'Minimum rating',
      value: '3+ stars',
      showLabel: false,
      leadingStar: true,
    });

    expect(pill('Minimum rating: 3+ stars').textContent).toContain('★');
  });

  it('wears none when it is not asked', () => {
    renderDropdown();

    expect(pill().textContent).not.toContain('★');
  });
});

describe('FilterDropdown — choosing', () => {
  it('lists every option once it is open', () => {
    renderDropdown();
    openDropdown();

    expect(option('All Genres')).toBeTruthy();
    expect(option('Drama')).toBeTruthy();
    expect(option('Comedy')).toBeTruthy();
  });

  it('reports the option that was chosen', () => {
    const onSelect = vi.fn();
    renderDropdown({ options: genreOptions(onSelect) });
    openDropdown();

    fireEvent.click(option('Drama'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shuts the panel on a choice, focus back on the pill', () => {
    renderDropdown();
    const control = openDropdown();

    fireEvent.click(option('Drama'));

    expect(noOption('Comedy')).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('marks the current option as the current one', () => {
    renderDropdown();
    openDropdown();

    expect(option('All Genres').getAttribute('aria-current')).toBe('true');
    expect(option('Drama').getAttribute('aria-current')).toBeNull();
  });
});

describe('FilterDropdown — the counts', () => {
  it('shows an option’s count when it has one', () => {
    renderDropdown();
    openDropdown();

    expect(option('Drama').textContent).toContain('6');
  });

  it('keeps the count out of the option’s accessible name', () => {
    renderDropdown();
    openDropdown();

    // Announced as "Drama", not "Drama 6".
    expect(option('Drama')).toBeTruthy();
  });

  it('renders nothing at all for an option with no count', () => {
    renderDropdown();
    openDropdown();

    expect(option('Comedy').textContent).toBe('Comedy');
  });
});

describe('FilterDropdown — getting rid of it', () => {
  it('closes on Escape and gives focus back to the pill', () => {
    renderDropdown();
    const control = openDropdown();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(noOption('Comedy')).toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control);
  });

  it('closes on a press outside it and gives focus back to the pill', () => {
    renderDropdown();
    const control = openDropdown();

    fireEvent.pointerDown(document.body);

    expect(noOption('Comedy')).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('closes when the pill is used a second time', () => {
    renderDropdown();
    const control = openDropdown();

    fireEvent.click(control);

    expect(noOption('Comedy')).toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('FilterDropdown — one open at a time', () => {
  /** Two pills side by side, the way the browse header carries three. */
  function renderPair() {
    return render(
      <ThemeProvider theme={theme}>
        <FilterDropdown
          label="Genre"
          value="All Genres"
          options={genreOptions()}
        />
        <FilterDropdown
          label="Sort"
          value="Recently Added"
          options={[
            {
              label: 'Recently Added',
              selected: true,
              onSelect: () => undefined,
            },
            {
              label: 'Title (A–Z)',
              selected: false,
              onSelect: () => undefined,
            },
          ]}
        />
      </ThemeProvider>
    );
  }

  it('closes the open one when the other is opened', () => {
    renderPair();
    openDropdown('Genre: All Genres');

    // A real press is a pointerdown and then a click; the pointerdown lands
    // outside the Genre slot, which is what shuts it — no coordinating state.
    const other = pill('Sort: Recently Added');
    fireEvent.pointerDown(other);
    fireEvent.click(other);

    expect(noOption('Comedy')).toBeNull();
    expect(option('Title (A–Z)')).toBeTruthy();
  });
});

describe('FilterDropdown — from the keyboard', () => {
  it('gives the pill focus, so it can be reached by tabbing', () => {
    renderDropdown();

    pill().focus();

    expect(document.activeElement).toBe(pill());
  });

  it('gives every option focus, so the list can be walked', () => {
    renderDropdown();
    openDropdown();

    option('Drama').focus();

    expect(document.activeElement).toBe(option('Drama'));
  });

  it('is operated by activating the focused option', () => {
    const onSelect = vi.fn();
    renderDropdown({ options: genreOptions(onSelect) });
    openDropdown();

    const row = option('Drama');
    row.focus();
    // Enter and Space on a focused button both arrive here as a click.
    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('FilterDropdown — how wide the panel is', () => {
  /** The panel is the box the options sit in — reached through the DOM, not a class. */
  const panel = () => option('Drama').parentElement as HTMLElement;

  it('opens at the prototype’s 200px when the caller says nothing', () => {
    renderDropdown();
    openDropdown();

    expect(getComputedStyle(panel()).minWidth).toBe('200px');
  });

  it('opens as wide as a caller asks', () => {
    renderDropdown({ menuWidth: 240 });
    openDropdown();

    expect(getComputedStyle(panel()).minWidth).toBe('240px');
  });
});

/**
 * 21 — Motion & interaction states, Phase 3 (issue #183): the Filter dropdown's
 * trigger on `controlStates`, and its option rows, as
 * `mol.FilterDropdown.dc.html` draws them. The library's sort and genre
 * dropdowns are both this pill.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * read as the rule written for it, whitespace aside — the way Button's are.
 */
describe('FilterDropdown — hover, press and keyboard focus', () => {
  interface Rule {
    selector: string;
    body: string;
  }

  const squash = (css: string) => css.replace(/\s+/g, '');
  /** `0.32` and `.32` are the same number; compare them as one. */
  const norm = (css: string) => squash(css).replace(/([(,:])0\./g, '$1.');

  function parse(css: string): Rule[] {
    return [...norm(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1],
      body: m[2],
    }));
  }

  function rulesOf(tree: ReactElement): Rule[] {
    const sheet = new ServerStyleSheet();
    try {
      renderToString(
        sheet.collectStyles(<ThemeProvider theme={theme}>{tree}</ThemeProvider>)
      );
      return parse(
        sheet
          .getStyleTags()
          .replace(/<\/?style[^>]*>/g, '')
          .replace(/\/\*!sc\*\//g, '')
      );
    } finally {
      sheet.seal();
    }
  }

  /**
   * The rules the live document holds for one mounted element — an option row
   * only exists once the panel is open, which a server render never draws.
   */
  function rulesFor(element: Element): Rule[] {
    const css = Array.from(document.querySelectorAll('style'))
      .map((tag) => tag.textContent ?? '')
      .join('\n');
    const classes = Array.from(element.classList);
    return parse(css).filter((rule) =>
      classes.some((name) => rule.selector.includes(`.${name}`))
    );
  }

  function state(rules: Rule[], pseudo: string): string {
    return rules
      .filter((rule) => rule.selector.includes(pseudo))
      .map((rule) => rule.body)
      .join(';');
  }

  const c = theme.colors;
  const eased = () => norm(`${theme.motion.durFast} ${theme.motion.easeOut}`);

  const triggers = [
    ['Genre', 'All Genres'],
    ['Sort', 'Recently added'],
  ] as const;

  function dropdown(label: string, value: string) {
    return (
      <FilterDropdown label={label} value={value} options={genreOptions()} />
    );
  }

  it.each(triggers)(
    'hovers the %s trigger to the accent line and the surface2 fill',
    (label, value) => {
      const hover = state(rulesOf(dropdown(label, value)), ':hover');

      expect(hover).toContain(norm(`border-color:${c.accentLine}`));
      expect(hover).toContain(norm(`background:${c.surface2}`));
    }
  );

  it.each(triggers)(
    'presses the %s trigger at scale(.98), in 60ms, like a Button',
    (label, value) => {
      const press = state(rulesOf(dropdown(label, value)), ':active');

      expect(press).toContain('transform:scale(.98)');
      expect(press).toContain('transition-duration:60ms');
    }
  );

  it.each(triggers)(
    'rings the %s trigger with the accent Focus ring under Tab, and not for a click',
    (label, value) => {
      const rules = rulesOf(dropdown(label, value));

      const focus = state(rules, ':focus-visible');
      expect(focus).toContain(norm(`box-shadow:0 0 0 3px ${c.focusRing}`));
      expect(focus).toContain('outline:none');
      expect(
        rules.filter((rule) => /:focus(?!-visible)/.test(rule.selector))
      ).toEqual([]);
    }
  );

  it('eases the trigger’s states in at durFast on easeOut', () => {
    const resting = rulesOf(dropdown('Genre', 'All Genres'))
      .filter((rule) => !rule.selector.includes(':'))
      .map((rule) => rule.body)
      .join(';');

    for (const property of ['background', 'border-color', 'transform']) {
      expect(resting).toContain(`${property}${eased()}`);
    }
  });

  it('highlights an open option to surface3 under the pointer, easing background and colour at durFast', () => {
    renderDropdown();
    openDropdown();

    const rules = rulesFor(option('Comedy'));
    const resting = rules
      .filter((rule) => !rule.selector.includes(':'))
      .map((rule) => rule.body)
      .join(';');

    expect(state(rules, ':hover')).toContain(norm(`background:${c.surface3}`));
    expect(resting).toContain(`background${eased()}`);
    expect(resting).toContain(`color${eased()}`);
  });
});
