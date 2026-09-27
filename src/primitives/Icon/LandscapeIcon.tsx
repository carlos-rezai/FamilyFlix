import { IconBase, type IconProps } from './IconBase';

/**
 * A framed landscape — the glyph of _Posters into each movie folder_, the
 * third **Write target** under the Enrichment setup's _Where it is saved_,
 * `feat.EnrichmentFlow.dc.html`: the frame, a ringed sun and a rolling ridge.
 */
export const LandscapeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <circle cx="8.5" cy="9.5" r="1.7" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M4 17l5-4 4 3 3-2 4 3"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
