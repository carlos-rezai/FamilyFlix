import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import styled, { ThemeProvider } from 'styled-components';
import { readFileSync } from 'node:fs';

// Through the category barrel — the path MainLayout, CardCarousel, PosterCard
// and the movie detail page all import it by.
import { IconButton, GearIcon, type IconButtonProps } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

function renderIconButton(props: Partial<IconButtonProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <IconButton label={props.label ?? 'Settings'} {...props}>
        {props.children ?? <GearIcon size={22} />}
      </IconButton>
    </ThemeProvider>
  );
}

describe('IconButton', () => {
  it('draws the icon it is given', () => {
    const { container } = renderIconButton();

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('carries its accessible name, so an icon-only control is still named', () => {
    renderIconButton({ label: 'Scroll left' });

    const button = screen.getByRole('button', { name: 'Scroll left' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('raises the handler when clicked', () => {
    const onClick = vi.fn();
    renderIconButton({ label: 'More options', onClick });

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['ghost', 'outline'] as const)(
    'stays a working control as the %s variant',
    (variant) => {
      const onClick = vi.fn();
      renderIconButton({ label: 'Settings', variant, onClick });

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    }
  );
});

describe('IconButton — the tooltip', () => {
  it('carries no tooltip by default', () => {
    renderIconButton({ label: 'Settings' });

    // Four of the call sites this replaces have no tooltip today, and gaining
    // one would be a change nothing designed.
    expect(
      screen.getByRole('button', { name: 'Settings' }).getAttribute('title')
    ).toBeNull();
  });

  it('carries a tooltip when given one, without disturbing its name', () => {
    renderIconButton({ label: 'Mark as watched', title: 'Mark as watched' });

    const button = screen.getByRole('button', { name: 'Mark as watched' });
    expect(button.getAttribute('title')).toBe('Mark as watched');
  });
});

describe('IconButton — as a toggle', () => {
  it('claims no toggle state when it is a plain action', () => {
    renderIconButton({ label: 'Scroll right' });

    // A button that toggles nothing must not report itself as unpressed —
    // that would announce a state it does not have.
    expect(
      screen
        .getByRole('button', { name: 'Scroll right' })
        .hasAttribute('aria-pressed')
    ).toBe(false);
  });

  it('reports itself unpressed when it is off', () => {
    renderIconButton({ label: 'Favorite', pressed: false });

    expect(
      screen
        .getByRole('button', { name: 'Favorite' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('reports itself pressed, so the accent fill is not the only signal', () => {
    renderIconButton({ label: 'Favorite', pressed: true });

    expect(
      screen
        .getByRole('button', { name: 'Favorite' })
        .getAttribute('aria-pressed')
    ).toBe('true');
  });
});

describe('IconButton — disabled', () => {
  it('does not raise the handler when clicked', () => {
    const onClick = vi.fn();
    renderIconButton({ label: 'Settings', disabled: true, onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('is a genuinely disabled control, not one that merely looks muted', () => {
    renderIconButton({ label: 'Settings', disabled: true });

    const button = screen.getByRole('button', { name: 'Settings' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('IconButton — extended at the call site', () => {
  it('wears a className, which is how each call site adds its own chrome', () => {
    // Three call sites float this button over artwork with their own blur and
    // alpha. `styled(IconButton)` is the whole mechanism, and it works only if
    // the generated class reaches the element.
    const Floating = styled(IconButton)`
      backdrop-filter: blur(10px);
    `;

    render(
      <ThemeProvider theme={theme}>
        <Floating label="More options">
          <GearIcon size={20} />
        </Floating>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'More options' });
    expect(button.className.split(' ').length).toBeGreaterThan(1);
  });
});

describe('IconButton — the ref', () => {
  it('hands its element to a caller that needs one', () => {
    // The ⋯ overflow menu returns focus to its trigger on every close path,
    // which it can only do by holding the button itself.
    let captured: HTMLButtonElement | null = null;

    render(
      <ThemeProvider theme={theme}>
        <IconButton
          label="More options"
          ref={(node) => {
            captured = node;
          }}
        >
          <GearIcon size={20} />
        </IconButton>
      </ThemeProvider>
    );

    expect(captured).toBe(screen.getByRole('button', { name: 'More options' }));
  });
});

/**
 * 21 — Motion & interaction states, Phase 4 (issue #184): IconButton on the
 * Control fragment, as `prim.IconButton.dc.html` draws it.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the rendered button in that
 * state — the cascade run by `resolvedStyle` — never a computed style.
 */
describe('IconButton — hover, press and keyboard focus', () => {
  const c = theme.colors;

  it.each(['ghost', 'outline'] as const)(
    'grows the %s face to scale(1.06) under the pointer',
    (variant) => {
      renderIconButton({ variant });

      expect(
        resolvedStyle(screen.getByRole('button'), { hover: true }).transform
      ).toBe(normCss('scale(1.06)'));
    }
  );

  it('moves the outline face’s border to textFaint under the pointer', () => {
    renderIconButton({ variant: 'outline' });

    expect(
      resolvedStyle(screen.getByRole('button'), { hover: true })['border-color']
    ).toBe(normCss(c.textFaint));
  });

  it('shrinks to scale(.94) when pressed, in 60ms', () => {
    renderIconButton();

    const press = resolvedStyle(screen.getByRole('button'), {
      hover: true,
      active: true,
    });
    expect(press.transform).toBe(normCss('scale(.94)'));
    expect(press['transition-duration']).toBe('60ms');
  });

  it('eases its transform in at durFast on easeOut', () => {
    renderIconButton();

    expect(
      resolvedStyle(screen.getByRole('button')).transition ?? ''
    ).toContain(
      normCss(`transform ${theme.motion.durFast} ${theme.motion.easeOut}`)
    );
  });

  it('takes the accent Focus ring under Tab', () => {
    renderIconButton();

    expect(
      resolvedStyle(screen.getByRole('button'), { focusVisible: true })[
        'box-shadow'
      ]
    ).toBe(normCss(`0 0 0 3px ${c.focusRing}`));
  });
});

describe('IconButton — the rules its docblock sets its extensions', () => {
  /** The docblock over `Root`: the rules every `styled(IconButton)` follows. */
  function docblock(): string {
    const source = readFileSync(
      'src/primitives/IconButton/IconButton.styles.ts',
      'utf8'
    );
    const before = source.slice(0, source.indexOf('export const Root'));
    const block = before.slice(before.lastIndexOf('/**'));
    return block.replace(/^\s*\*\/?\s?/gm, ' ').replace(/\s+/g, ' ');
  }

  it('widens rule 2 to background, color, border-color and transform', () => {
    const rule2 = /\s2\.\s(.*?)(?:\s3\.\s|$)/.exec(docblock())?.[1] ?? '';

    for (const property of [
      'background',
      'color',
      'border-color',
      'transform',
    ]) {
      expect(rule2).toContain(`\`${property}\``);
    }
  });

  it('tells an extension that positions with transform to restate it on hover and compose it into the press', () => {
    const text = docblock();

    expect(text).toMatch(/position[^.]*`transform`/i);
    expect(text).toMatch(/restate[^.]*hover/i);
    expect(text).toMatch(/compose[^.]*press/i);
  });
});
