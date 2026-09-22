import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

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

  it.each(['sm', 'md', 'lg'] as const)('keeps its label at size %s', (size) => {
    renderButton({ label: 'Check for updates', size });

    expect(
      screen.getByRole('button', { name: 'Check for updates' })
    ).toBeTruthy();
  });

  it('draws sm at the prototype’s 40px, 18px sides, 14px text and the small radius', () => {
    // The third size, from `prim.Button.dc.html`'s enum: what the **Review
    // step**'s _Resolve_ and _Skip_ are drawn at (issue #129). One rung
    // below `md` in every dimension, and the `sm` radius rather than `md`'s.
    renderButton({ label: 'Skip', size: 'sm' });

    const style = getComputedStyle(
      screen.getByRole('button', { name: 'Skip' })
    );
    expect(style.height).toBe('40px');
    expect(style.paddingLeft).toBe('18px');
    expect(style.paddingRight).toBe('18px');
    expect(style.fontSize).toBe('14px');
    expect(style.borderRadius).toBe('8px');
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

describe('Button — as a router link', () => {
  function renderLink(to: string, label = 'Back to library') {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Button label={label} to={to} variant="secondary" />
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  it('renders a real link to that destination', () => {
    renderLink('/');

    // A real anchor, so a parent can middle-click it into a new window and
    // assistive technology announces a navigation rather than an action.
    const link = screen.getByRole('link', { name: 'Back to library' });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('offers no button affordance, so it is not both at once', () => {
    renderLink('/');

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('still draws its leading glyph', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Button label="Play" to="/movie/m1/play" icon="play" />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Play' })).toBeTruthy();
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

/**
 * 21 — Motion & interaction states, Phase 2 (issue #182): Button, the first
 * **Control** on `controlStates`.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * read as the rule Button writes for it — off the CSS styled-components
 * produces for one rendered Button, whitespace aside — against the values
 * `prim.Button.dc.html` draws.
 */
describe('Button — hover, press and keyboard focus', () => {
  interface Rule {
    selector: string;
    body: string;
  }

  const squash = (css: string) => css.replace(/\s+/g, '');
  /** `0.12` and `.12` are the same number; compare them as one. */
  const norm = (css: string) => squash(css).replace(/([(,:])0\./g, '$1.');

  function rulesOf(tree: ReactElement): Rule[] {
    const sheet = new ServerStyleSheet();
    try {
      renderToString(
        sheet.collectStyles(
          <ThemeProvider theme={theme}>
            <MemoryRouter>{tree}</MemoryRouter>
          </ThemeProvider>
        )
      );
      const css = norm(
        sheet
          .getStyleTags()
          .replace(/<\/?style[^>]*>/g, '')
          .replace(/\/\*!sc\*\//g, '')
      );
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
        selector: m[1],
        body: m[2],
      }));
    } finally {
      sheet.seal();
    }
  }

  function state(rules: Rule[], suffix: string): string {
    return rules
      .filter((rule) => rule.selector.endsWith(suffix))
      .map((rule) => rule.body)
      .join(';');
  }

  const HOVER = ':hover:not(:disabled)';
  const PRESS = ':active:not(:disabled)';

  const c = theme.colors;
  const drawn = {
    primary: {
      hover: [`background:${c.accentHover}`],
      press: [`background:${c.accentPress}`],
    },
    secondary: {
      hover: [`background:${c.surface2}`, `border-color:${c.textFaint}`],
      press: [`background:${c.surface3}`],
    },
    ghost: {
      hover: [`background:${c.surface}`],
      press: [`background:${c.surface2}`],
    },
    danger: {
      hover: ['background:rgba(201,122,106,.12)', `border-color:${c.danger}`],
      press: ['background:rgba(201,122,106,.2)'],
    },
  } as const;

  const cases = (['primary', 'secondary', 'ghost', 'danger'] as const).flatMap(
    (variant) => (['sm', 'md'] as const).map((size) => [variant, size] as const)
  );

  it.each(cases)('%s at %s hovers as prim.Button draws it', (variant, size) => {
    const hover = state(
      rulesOf(<Button label="Export" variant={variant} size={size} />),
      HOVER
    );

    for (const declaration of drawn[variant].hover) {
      expect(hover).toContain(norm(declaration));
    }
    // A Control signals with colour: its hover never lifts it.
    expect(hover).not.toContain('transform');
  });

  it.each(cases)(
    '%s at %s presses as prim.Button draws it, at scale(.98)',
    (variant, size) => {
      const press = state(
        rulesOf(<Button label="Export" variant={variant} size={size} />),
        PRESS
      );

      for (const declaration of drawn[variant].press) {
        expect(press).toContain(norm(declaration));
      }
      expect(press).toContain('transform:scale(.98)');
    }
  );

  it.each(cases)(
    '%s at %s presses faster than its hover eases in',
    (variant, size) => {
      const rules = rulesOf(
        <Button label="Export" variant={variant} size={size} />
      );
      // No `\b` after the unit: squashed, `120ms cubic-bezier(` is one word.
      const ms = (value: string) =>
        [...value.matchAll(/(\d*\.?\d+)(ms|s)/g)].map(([, n, unit]) =>
          unit === 's' ? Number(n) * 1000 : Number(n)
        );
      const resting = rules
        .filter((rule) => !rule.selector.includes(':'))
        .map((rule) => rule.body)
        .join(';');

      const press = ms(
        /transition-duration:([^;]*)/.exec(state(rules, PRESS))?.[1] ?? ''
      );
      const hover = ms(/transition:([^;]*)/.exec(resting)?.[1] ?? '');

      expect(press.length).toBeGreaterThan(0);
      expect(hover.length).toBeGreaterThan(0);
      expect(Math.max(...press)).toBeLessThan(Math.min(...hover));
    }
  );

  it('shows no hover and no press when disabled: every state is guarded by :not(:disabled)', () => {
    const rules = rulesOf(<Button label="Finish" disabled />);
    const stateful = rules.filter((rule) =>
      /:(hover|active)/.test(rule.selector)
    );

    expect(stateful.length).toBeGreaterThan(0);
    for (const rule of stateful) {
      expect(rule.selector).toContain(':not(:disabled)');
    }
    // `:enabled` is what an anchor never matches; the guard is not it.
    expect(rules.some((rule) => rule.selector.includes(':enabled'))).toBe(
      false
    );
  });

  it('gives the link face — Back to library — a hover, a press and the ring', () => {
    const rules = rulesOf(
      <Button label="Back to library" to="/" variant="secondary" />
    );

    expect(state(rules, HOVER)).toContain(norm(`background:${c.surface2}`));
    expect(state(rules, PRESS)).toContain('transform:scale(.98)');
    expect(state(rules, ':focus-visible')).toContain(
      norm(`box-shadow:0 0 0 3px ${c.focusRing}`)
    );
  });

  it.each(cases)(
    '%s at %s draws the accent Focus ring under Tab, as a shadow that follows its corners',
    (variant, size) => {
      const rules = rulesOf(
        <Button label="Export" variant={variant} size={size} />
      );

      const focus = state(rules, ':focus-visible');
      expect(focus).toContain(norm(`box-shadow:0 0 0 3px ${c.focusRing}`));
      expect(focus).toContain('outline:none');
    }
  );

  it('draws no ring for a click: nothing styles plain :focus', () => {
    const rules = rulesOf(<Button label="Export" />);

    expect(
      rules.filter((rule) => /:focus(?!-visible)/.test(rule.selector))
    ).toEqual([]);
  });
});
