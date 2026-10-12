import type { ReactNode } from 'react';

import { BackButton } from '../BackButton/BackButton';
import { End, Eyebrow, Heading, Lede, Row, Titles } from './PageHeader.styles';

export interface PageHeaderProps {
  /**
   * Where Back goes — the screen's own `useGoBack`. Omitted by a screen that
   * draws its **Back button** itself, above states that have no header.
   */
  onBack?: () => void;
  /** Back's accessible name, when the screen says where it goes. */
  backLabel?: string;
  /** The screen's one heading. */
  heading: ReactNode;
  /** A small line above the heading, when the heading is part of something. */
  eyebrow?: ReactNode;
  /** The screen's own controls at the row's end — a badge, tabs, a button. */
  end?: ReactNode;
  /** The line under the heading. */
  lede?: ReactNode;
}

/**
 * The header every column screen opens with: the **Back button** in its
 * corner, the heading on Back's line at the column's edge, the screen's own
 * controls at the row's end, and the lede under them. Written once, so no two
 * screens can draw it a few pixels apart. Presentational — the caller hands it
 * the words and where Back goes.
 */
export function PageHeader({
  onBack,
  backLabel,
  heading,
  eyebrow,
  end,
  lede,
}: PageHeaderProps) {
  return (
    <>
      {onBack ? <BackButton onClick={onBack} label={backLabel} /> : null}
      <Row>
        <Titles>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Heading>{heading}</Heading>
        </Titles>
        {end ? <End>{end}</End> : null}
      </Row>
      {lede ? <Lede>{lede}</Lede> : null}
    </>
  );
}
