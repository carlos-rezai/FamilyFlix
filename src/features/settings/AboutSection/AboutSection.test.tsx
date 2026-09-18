import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { AboutSection } from './AboutSection';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 15 — Settings hub, Phase 5: "the About card" (issue #147).
 *
 * The Settings hub's About **Settings group**, from
 * `page.SettingsPage.dc.html`: the `About` **Group heading** over a
 * **Section card** holding one row — the brand row. **Family** in serif then
 * **Flix** in the accent, the **App version** in mono beside it, and
 * _Offline · local-only · no account_ pushed to the far end.
 *
 * No _Software update_ row and no rule above the brand row: the card does not
 * say _You're up to date_ with no updater to know it. The section owns no
 * hook — the version is `__APP_VERSION__`, `package.json`'s `version` baked in
 * at build by Vite's `define`, so the card and the installer can never
 * disagree, and it reads `0.0.0` until the packaging initiative sets one.
 */

function renderSection() {
  return render(
    <ThemeProvider theme={theme}>
      <AboutSection />
    </ThemeProvider>
  );
}

const TAGLINE = 'Offline · local-only · no account';

/** `package.json`'s `version`, read off disk — what the build bakes in. */
const packageVersion = (): string =>
  (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
    .version;

describe('AboutSection — the heading and the brand', () => {
  it('is headed About', () => {
    renderSection();

    expect(screen.getByText('About')).toBeDefined();
  });

  it('draws the heading, then the brand', () => {
    renderSection();

    expect(
      comesBefore(screen.getByText('About'), screen.getByText('Family'))
    ).toBe(true);
  });

  it('sets Family in serif at 18px bold, in the text ink', () => {
    renderSection();

    const style = getComputedStyle(screen.getByText('Family'));
    expect(style.fontFamily).toContain('Source Serif 4');
    expect(style.fontSize).toBe('18px');
    expect(style.fontWeight).toBe('700');
    expect(style.color).toBe('rgb(243, 236, 224)');
  });

  it('sets Flix in the same serif, in the accent', () => {
    renderSection();

    const style = getComputedStyle(screen.getByText('Flix'));
    expect(style.fontFamily).toContain('Source Serif 4');
    expect(style.fontSize).toBe('18px');
    expect(style.fontWeight).toBe('700');
    expect(style.color).toBe('rgb(217, 122, 78)');
  });

  it('runs Family straight into Flix', () => {
    renderSection();

    const family = screen.getByText('Family');
    const flix = screen.getByText('Flix');
    expect(comesBefore(family, flix)).toBe(true);
    expect(family.parentElement).toBe(flix.parentElement);
    expect(family.parentElement?.textContent).toBe('FamilyFlix');
  });
});

describe('AboutSection — the version', () => {
  it('shows the defined version — __APP_VERSION__ — beside the brand', () => {
    renderSection();

    const version = screen.getByText(__APP_VERSION__);
    expect(comesBefore(screen.getByText('Flix'), version)).toBe(true);
  });

  it("shows package.json's version, so the card and the installer agree", () => {
    renderSection();

    expect(screen.getByText(packageVersion())).toBeDefined();
    expect(__APP_VERSION__).toBe(packageVersion());
  });

  it('reads 0.0.0 until the packaging initiative sets one', () => {
    renderSection();

    // The truth about this build, not a placeholder: `package.json` says
    // `0.0.0` today, and the card says the same.
    expect(screen.getByText('0.0.0')).toBeDefined();
  });

  it('sets the version in mono at 13px, faint', () => {
    renderSection();

    const style = getComputedStyle(screen.getByText(__APP_VERSION__));
    expect(style.fontFamily).toMatch(/mono/i);
    expect(style.fontSize).toBe('13px');
    expect(style.color).toBe('rgb(133, 122, 104)');
  });
});

describe('AboutSection — the tagline', () => {
  it('reads Offline · local-only · no account', () => {
    renderSection();

    expect(screen.getByText(TAGLINE)).toBeDefined();
  });

  it('sets the tagline in sans at 13px, faint', () => {
    renderSection();

    const style = getComputedStyle(screen.getByText(TAGLINE));
    expect(style.fontFamily).toContain('Hanken Grotesk');
    expect(style.fontSize).toBe('13px');
    expect(style.color).toBe('rgb(133, 122, 104)');
  });

  it('pushes the tagline to the far end, after the version', () => {
    renderSection();

    expect(
      comesBefore(screen.getByText(__APP_VERSION__), screen.getByText(TAGLINE))
    ).toBe(true);
  });
});

describe('AboutSection — what it does not draw', () => {
  it('draws no Software update row', () => {
    renderSection();

    expect(screen.queryByText(/software update/i)).toBeNull();
    expect(screen.queryByText(/check for updates/i)).toBeNull();
    expect(screen.queryByText(/update now/i)).toBeNull();
  });

  it("never says You're up to date — there is no updater to know it", () => {
    renderSection();

    expect(screen.queryByText(/up to date/i)).toBeNull();
    expect(screen.queryByText(/is available to install/i)).toBeNull();
    expect(screen.queryByText(/downloading and installing/i)).toBeNull();
  });

  it('holds no button — the brand row is the whole card', () => {
    renderSection();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('owns no hook — nothing is fetched to draw it', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      renderSection();

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
