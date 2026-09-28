import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { SetupBanner, type SetupBannerProps } from './SetupBanner';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: `SetupBanner` is its own
 * unit.
 *
 * The **Setup step**'s banner, 1:1 with the prototype's two: `danger` — the
 * 0.1 and 0.32 danger tint, top-aligned, the 20px glyph in the danger ink,
 * _Retry_ as a secondary button — and `accent` — the accent-soft fill inside
 * the accent line, centred, no glyph, its button primary. The organism decides
 * when each is drawn; the molecule only draws it.
 */
function renderBanner(props: Partial<SetupBannerProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SetupBanner
        tone="danger"
        title="No internet connection"
        line="Everything already in your library stays available."
        actionLabel="Retry"
        onAction={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const ACCENT_BANNER: Partial<SetupBannerProps> = {
  tone: 'accent',
  title: 'A TMDB API key is needed first',
  line: 'Paste it under Settings → Network.',
  actionLabel: 'Open Network settings',
};

/** The banner's own box: the title's text column's parent. */
const bannerOf = (title: string) => {
  const box = screen.getByText(title).parentElement?.parentElement;
  if (!box) throw new Error('no banner');
  return box;
};

const style = (element: Element, property: string) =>
  normCss(resolvedStyle(element)[property] ?? '');

describe('SetupBanner — what it draws', () => {
  it('draws its title, its line and its button', () => {
    renderBanner();

    expect(screen.getByText('No internet connection')).toBeDefined();
    expect(
      screen.getByText('Everything already in your library stays available.')
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('calls onAction on the button’s press', () => {
    const onAction = vi.fn();
    renderBanner({ onAction });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('SetupBanner — the danger tone', () => {
  it('sits on the danger tint inside the danger line', () => {
    renderBanner();

    const banner = bannerOf('No internet connection');
    expect(style(banner, 'background')).toBe(
      normCss('rgba(201, 122, 106, 0.1)')
    );
    expect(style(banner, 'border')).toBe(
      normCss('1px solid rgba(201, 122, 106, 0.32)')
    );
  });

  it('is top-aligned, so the glyph sits with the title', () => {
    renderBanner();

    expect(style(bannerOf('No internet connection'), 'align-items')).toBe(
      'flex-start'
    );
  });

  it('draws its 20px glyph in the danger ink', () => {
    renderBanner();

    const glyph = bannerOf('No internet connection').querySelector('svg');
    expect(glyph?.getAttribute('width')).toBe('20');
    expect(style(glyph?.parentElement as Element, 'color')).toBe(
      theme.colors.danger
    );
  });

  it('draws its button as a secondary', () => {
    renderBanner();

    expect(
      style(screen.getByRole('button', { name: 'Retry' }), 'background')
    ).not.toBe(normCss(theme.colors.accent));
  });
});

describe('SetupBanner — the accent tone', () => {
  it('sits on the accent-soft fill inside the accent line', () => {
    renderBanner(ACCENT_BANNER);

    const banner = bannerOf('A TMDB API key is needed first');
    expect(style(banner, 'background')).toBe(normCss(theme.colors.accentSoft));
    expect(style(banner, 'border')).toBe(
      normCss(`1px solid ${theme.colors.accentLine}`)
    );
  });

  it('is centred', () => {
    renderBanner(ACCENT_BANNER);

    expect(
      style(bannerOf('A TMDB API key is needed first'), 'align-items')
    ).toBe('center');
  });

  it('draws no glyph', () => {
    renderBanner(ACCENT_BANNER);

    expect(
      bannerOf('A TMDB API key is needed first').querySelector('svg')
    ).toBeNull();
  });

  it('draws its button as the primary', () => {
    renderBanner(ACCENT_BANNER);

    expect(
      style(
        screen.getByRole('button', { name: 'Open Network settings' }),
        'background'
      )
    ).toBe(normCss(theme.colors.accent));
  });
});
