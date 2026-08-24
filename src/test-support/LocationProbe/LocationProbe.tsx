import { useLocation, useNavigate } from 'react-router-dom';

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
 * suite reads the same three spellings — `pathname`, `search` and the two
 * joined as `url` — so an assertion can move between files unchanged.
 */
export function LocationProbe({ withBack = false }: LocationProbeProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="url">{`${location.pathname}${location.search}`}</div>
      {withBack && (
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      )}
    </>
  );
}
