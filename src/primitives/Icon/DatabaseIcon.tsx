import { IconBase, type IconProps } from './IconBase';

/**
 * A stacked cylinder — the glyph of _Your library_, the first **Write target**
 * under the Enrichment setup's _Where it is saved_, `feat.EnrichmentFlow.dc.html`:
 * the lid and two bands, stroked at 1.7.
 */
export const DatabaseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <ellipse
      cx="12"
      cy="6"
      rx="7"
      ry="3"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </IconBase>
);
