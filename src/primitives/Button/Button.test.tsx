import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

// Imported through the category barrel, the way every consumer will import it
// (MovieForm, SettingsPage, ImportFlow, ExportModal) — there is no per-unit
// barrel, so this is the whole public surface.
import { Button, type ButtonProps } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
  type StyleState,
} from '@/test-support/resolvedStyle/resolvedStyle';

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

describe('Button — a caller’s chrome', () => {
  // A caller places the button with `styled(Button)` — the Storage card holds
  // _Open folder_'s width that way — which works only if the generated class
  // reaches the element, in both forms.
  const Placed = styled(Button)`
    margin-top: 7px;
  `;

  it('wears a className, which is how each call site adds its own chrome', () => {
    render(
      <ThemeProvider theme={theme}>
        <Placed label="Open folder" variant="secondary" size="sm" />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Open folder' });
    expect(getComputedStyle(button).marginTop).toBe('7px');
  });

  it('wears a className as a router link too', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Placed label="Back to library" to="/" />
        </MemoryRouter>
      </ThemeProvider>
    );

    const link = screen.getByRole('link', { name: 'Back to library' });
    expect(getComputedStyle(link).marginTop).toBe('7px');
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
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each Button is
 * rendered into the document and `resolvedStyle` runs the cascade for the
 * named state — what wins there, against the values `prim.Button.dc.html`
 * draws. A press is always also a hover, so a press is resolved as both.
 */
describe('Button — hover, press and keyboard focus', () => {
  const HOVER: StyleState = { hover: true };
  const PRESS: StyleState = { hover: true, active: true };
  const KEYBOARD: StyleState = { focusVisible: true };

  /** One Button, rendered afresh, as the element its face is drawn on. */
  function face(tree: ReactElement, role: 'button' | 'link' = 'button') {
    cleanup();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>{tree}</MemoryRouter>
      </ThemeProvider>
    );
    return screen.getByRole(role);
  }

  /** Every duration in a value `normCss` has tidied, in milliseconds. */
  const ms = (value = '') =>
    [...value.matchAll(/(\d*\.?\d+)(ms|s)(?![\w-])/g)].map(([, n, unit]) =>
      unit === 's' ? Number(n) * 1000 : Number(n)
    );

  const c = theme.colors;
  const drawn = {
    primary: {
      hover: { background: c.accentHover },
      press: { background: c.accentPress },
    },
    secondary: {
      hover: { background: c.surface2, 'border-color': c.textFaint },
      press: { background: c.surface3 },
    },
    ghost: {
      hover: { background: c.surface },
      press: { background: c.surface2 },
    },
    danger: {
      hover: {
        background: 'rgba(201,122,106,.12)',
        'border-color': c.danger,
      },
      press: { background: 'rgba(201,122,106,.2)' },
    },
  } as const;

  const cases = (['primary', 'secondary', 'ghost', 'danger'] as const).flatMap(
    (variant) => (['sm', 'md'] as const).map((size) => [variant, size] as const)
  );

  it.each(cases)('%s at %s hovers as prim.Button draws it', (variant, size) => {
    const button = face(
      <Button label="Export" variant={variant} size={size} />
    );
    const hover = resolvedStyle(button, HOVER);

    for (const [property, value] of Object.entries(drawn[variant].hover)) {
      expect(hover[property]).toBe(normCss(value));
    }
    // A Control signals with colour: its hover never lifts it.
    expect(hover.transform).toBe(resolvedStyle(button).transform);
  });

  it.each(cases)(
    '%s at %s presses as prim.Button draws it, at scale(.98)',
    (variant, size) => {
      const press = resolvedStyle(
        face(<Button label="Export" variant={variant} size={size} />),
        PRESS
      );

      for (const [property, value] of Object.entries(drawn[variant].press)) {
        expect(press[property]).toBe(normCss(value));
      }
      expect(press.transform).toBe(normCss('scale(.98)'));
    }
  );

  it.each(cases)(
    '%s at %s presses faster than its hover eases in',
    (variant, size) => {
      const button = face(
        <Button label="Export" variant={variant} size={size} />
      );

      const press = ms(resolvedStyle(button, PRESS)['transition-duration']);
      const hover = ms(resolvedStyle(button).transition);

      expect(press.length).toBeGreaterThan(0);
      expect(hover.length).toBeGreaterThan(0);
      expect(Math.max(...press)).toBeLessThan(Math.min(...hover));
    }
  );

  it('shows no hover and no press when disabled: every state is guarded by :not(:disabled)', () => {
    const button = face(<Button label="Finish" disabled />);
    const resting = resolvedStyle(button);

    expect(resolvedStyle(button, HOVER)).toEqual(resting);
    expect(resolvedStyle(button, PRESS)).toEqual(resting);
  });

  it('gives the link face — Back to library — a hover, a press and the ring', () => {
    const link = face(
      <Button label="Back to library" to="/" variant="secondary" />,
      'link'
    );

    expect(resolvedStyle(link, HOVER).background).toBe(normCss(c.surface2));
    expect(resolvedStyle(link, PRESS).transform).toBe(normCss('scale(.98)'));
    expect(resolvedStyle(link, KEYBOARD)['box-shadow']).toBe(
      normCss(`0 0 0 3px ${c.focusRing}`)
    );
  });

  it.each(cases)(
    '%s at %s draws the accent Focus ring under Tab, as a shadow that follows its corners',
    (variant, size) => {
      const focus = resolvedStyle(
        face(<Button label="Export" variant={variant} size={size} />),
        KEYBOARD
      );

      expect(focus['box-shadow']).toBe(normCss(`0 0 0 3px ${c.focusRing}`));
      expect(focus.outline).toBe('none');
    }
  );

  it('draws no ring for a click: nothing styles plain :focus', () => {
    const button = face(<Button label="Export" />);

    expect(resolvedStyle(button, { focus: true })).toEqual(
      resolvedStyle(button)
    );
  });
});

/**
 * 53 — Loading states, Phase 2 (issue #484): **Button**'s busy props.
 *
 * `busy` is a **Busy phase**. `waiting` locks the button at once with its idle
 * label, its variant's face and its idle width kept; `shown` reads its
 * `busyLabel` politely with a shine in its own ink sweeping across it, a fade
 * under reduced motion.
 */
describe('Button — busy', () => {
  function renderBusy(props: Partial<ButtonProps> = {}) {
    return render(
      <ThemeProvider theme={theme}>
        <Button label="Add to library" {...props} />
      </ThemeProvider>
    );
  }

  it('is idle by default: live, and not busy', () => {
    renderBusy();

    const button = screen.getByRole('button', { name: 'Add to library' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).not.toBe('true');
  });

  it('is disabled and aria-busy with its idle label while waiting', () => {
    renderBusy({ busy: 'waiting', busyLabel: 'Adding…' });

    const button = screen.getByRole('button', { name: 'Add to library' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).not.toContain('Adding…');
  });

  it('draws its busyLabel in a polite live region once shown', () => {
    renderBusy({ busy: 'shown', busyLabel: 'Adding…' });

    const button = screen.getByRole('button', { name: 'Adding…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    const live = button.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Adding…');
  });

  it('reads its label as the busyLabel when none is given', () => {
    renderBusy({ busy: 'shown' });

    const button = screen.getByRole('button', { name: 'Add to library' });
    expect(button.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Add to library'
    );
  });

  it.each(['waiting', 'shown'] as const)(
    'never raises onClick while %s',
    (busy) => {
      const onClick = vi.fn();
      renderBusy({ busy, busyLabel: 'Adding…', onClick });

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).not.toHaveBeenCalled();
    }
  );

  describe('its face', () => {
    /** One Button, rendered afresh, as the element its face is drawn on. */
    function drawn(tree: ReactElement) {
      cleanup();
      render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
      return resolvedStyle(screen.getByRole('button'));
    }

    const chrome = ['background', 'color', 'border', 'opacity'] as const;

    it.each(
      (['primary', 'secondary', 'ghost', 'danger'] as const).flatMap(
        (variant) =>
          (['waiting', 'shown'] as const).map(
            (busy) => [variant, busy] as const
          )
      )
    )(
      'keeps the %s face while %s, not the grey disabled face, under a progress cursor',
      (variant, busy) => {
        const idle = drawn(<Button label="Export" variant={variant} />);
        const locked = drawn(
          <Button label="Export" variant={variant} busy={busy} />
        );

        for (const property of chrome) {
          expect(locked[property]).toBe(idle[property]);
        }
        expect(locked.cursor).toBe('progress');
      }
    );
  });

  describe('its width', () => {
    const IDLE_WIDTH = 183;

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
        IDLE_WIDTH
      );
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 50,
        right: IDLE_WIDTH,
        width: IDLE_WIDTH,
        height: 50,
        toJSON: () => ({}),
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function tree(busy: ButtonProps['busy']) {
      return (
        <ThemeProvider theme={theme}>
          <Button label="Save changes" busyLabel="Saving…" busy={busy} />
        </ThemeProvider>
      );
    }

    it('holds its idle width while busy, and lets it go when idle again', () => {
      const { rerender } = render(tree('idle'));
      const button = () => screen.getByRole('button');
      expect(button().style.minWidth).toBe('');

      rerender(tree('waiting'));
      expect(button().style.minWidth).toBe(`${IDLE_WIDTH}px`);

      rerender(tree('shown'));
      expect(button().style.minWidth).toBe(`${IDLE_WIDTH}px`);

      rerender(tree('idle'));
      expect(button().style.minWidth).toBe('');
    });
  });

  describe('its shine', () => {
    /** Every style tag's text, as styled-components injected it. */
    function injectedCss(): string {
      return Array.from(document.querySelectorAll('style'))
        .map((sheet) => sheet.textContent ?? '')
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    }

    /** The rules inside every `prefers-reduced-motion: reduce` block. */
    function reducedMotionRules(css: string) {
      const blocks = [
        ...css.matchAll(
          /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g
        ),
      ].map(([, body]) => body);
      return blocks.flatMap((body) =>
        [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
          ([, selector, declarations]) => ({
            selector: selector.trim(),
            declarations,
          })
        )
      );
    }

    /** The properties a named `@keyframes` block animates. */
    function keyframeProperties(css: string, name: string): string[] {
      const block = new RegExp(
        `@keyframes\\s+${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`
      ).exec(css);
      if (block === null) return [];
      return [...block[1].matchAll(/([\w-]+)\s*:/g)].map(
        ([, property]) => property
      );
    }

    /** The shown button's live label, the element the shine is drawn on. */
    function shownLabel(): HTMLElement {
      renderBusy({ busy: 'shown', busyLabel: 'Adding…' });
      return screen
        .getByRole('button')
        .querySelector('[aria-live="polite"]') as HTMLElement;
    }

    it('sweeps a mask over the shown label, in the label’s own ink', () => {
      const label = resolvedStyle(shownLabel());

      expect(label['mask-image'] ?? label['-webkit-mask-image']).toBeDefined();
      expect(label.animation ?? label['animation-name']).toBeDefined();
      // Its own ink: the shine never repaints the text one fixed colour.
      expect(label.color).toBeUndefined();
    });

    it('fades under reduced motion, a rule GlobalStyle’s * does not collapse', () => {
      const live = shownLabel();
      const css = injectedCss();

      const shine = reducedMotionRules(css).find(
        ({ selector, declarations }) =>
          /animation/.test(declarations) &&
          selector
            .split(',')
            .some((one) => live.matches(one.replace(/::?[\w-]+$/, '').trim()))
      );
      expect(shine).toBeDefined();

      // GlobalStyle's `*` collapses every animation with `!important`; only an
      // `!important` of its own, on a selector that out-ranks `*`, survives it.
      const declarations = shine?.declarations ?? '';
      expect(declarations).toMatch(/animation[^;]*!important/);
      expect(shine?.selector).toMatch(/[.#[]/);
      expect(declarations).not.toMatch(/0?\.01ms/);

      // A fade: the reduced-motion keyframes move nothing, only opacity.
      const name =
        /animation-name\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
        /animation\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
        '';
      const properties = keyframeProperties(css, name);
      expect(properties.length).toBeGreaterThan(0);
      expect(new Set(properties)).toEqual(new Set(['opacity']));
    });
  });
});
