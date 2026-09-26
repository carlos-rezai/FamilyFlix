import { IconBase, type IconProps } from './IconBase';

/**
 * A `!` in a ring drawn as one stroke — the glyph that leads the Enrichment
 * setup's offline banner, `feat.EnrichmentFlow.dc.html`: the ring at radius 9,
 * the stem and the dot one round-capped path at 1.8. `InfoRingIcon` upside
 * down, in its own weight.
 */
export const BangRingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16.5v.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
