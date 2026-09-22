import { screen } from '@testing-library/react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

export interface LocationProbeProps {
  /**
   * Adds a control labelled "Back" that steps the history back one entry.
   * Off by default, so a screen that has a Back button of its own keeps that
   * accessible name to itself.
   */
  withBack?: boolean;
}

/**
 * Renders where the router currently is, so a navigation can be asserted by
 * destination rather than inferred from whatever happened to render. Every
 * suite reads the same four spellings — `pathname`, `search`, the two joined
 * as `url`, and `navigationType` — so an assertion can move between files
 * unchanged.
 *
 * `navigationType` is *how* the router got here rather than where it is:
 * `POP` after a history step, `PUSH` after a push. It is the assertion that
 * tells a Back that stepped from a Back that pushed a duplicate entry, which
 * landing on the right URL alone cannot.
 */
export function LocationProbe({ withBack = false }: LocationProbeProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  return (
    <>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="url">{`${location.pathname}${location.search}`}</div>
      <div data-testid="navigationType">{navigationType}</div>
      {withBack && (
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      )}
    </>
  );
}

/** Where the router is, without its query — read off the probe on screen. */
export function pathname(): string | null {
  return screen.getByTestId('pathname').textContent;
}

/** The query string, `?` and all, or empty — read off the probe on screen. */
export function search(): string | null {
  return screen.getByTestId('search').textContent;
}

/** `pathname` and `search` joined — read off the probe on screen. */
export function url(): string | null {
  return screen.getByTestId('url').textContent;
}

/**
 * How the router got where the probe says it is — `POP` after a **History
 * step**, `PUSH` after a push — read off the probe on screen. Handed out
 * beside the component, on `fakeResponse`'s precedent of a unit with a second
 * export, because every suite that asserts a leaving reads the same line.
 */
export function navigationType(): string | null {
  return screen.getByTestId('navigationType').textContent;
}
