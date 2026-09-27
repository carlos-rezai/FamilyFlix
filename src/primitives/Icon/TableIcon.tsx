import { IconBase, type IconProps } from './IconBase';

/**
 * A ruled table — the glyph of the **Metadata sheet**, the second **Write
 * target** under the Enrichment setup's _Where it is saved_,
 * `feat.EnrichmentFlow.dc.html`: the frame, two rows and a column, stroked.
 */
export const TableIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="4"
      y="3"
      width="16"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path d="M4 9h16M4 15h16M10 3v18" stroke="currentColor" strokeWidth="1.5" />
  </IconBase>
);
