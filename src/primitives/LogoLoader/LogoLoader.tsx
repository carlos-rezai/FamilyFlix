import { useId } from 'react';
import { useTheme } from 'styled-components';

import { MARK_F1, MARK_F2, MARK_VIEWBOX } from '@/tokens';

import {
  ClipRect,
  Detail,
  F,
  Label,
  MarkBox,
  Root,
  Svg,
  Words,
  type Ink,
} from './LogoLoader.styles';

export interface LogoLoaderProps {
  /** Width in px; the height is the mark's own ratio, or square with `tile`. */
  size?: number;
  /** 0 to 1: the mark fills left to right. Left out, the Fs take turns rising. */
  progress?: number;
  /** `current` paints both Fs in `currentColor`. */
  tone?: 'brand' | 'current';
  /** The app-icon tile behind the mark. */
  tile?: boolean;
  /** Drawn under the mark, and the start of the status's name. */
  label?: string;
  /** The faint line under the label; `NN%` with `progress` by default. */
  detail?: string;
  /** Mark and words in a row rather than a column. */
  inline?: boolean;
}

/**
 * The **Logo loader** (`prim.LogoLoader.dc.html`): the two Fs of the mark take
 * turns rising, or, given a `progress`, fill left to right. A polite `status`
 * named by its label and detail (_Loading_ when it has neither); what it
 * draws is kept out of the accessible tree. The clip id comes from `useId`,
 * stripped of what a `url(#...)` reference cannot carry. Its Fs and their
 * viewBox are the brand tokens of `src/tokens/brand.ts`. Never drawn inside a
 * button: a **Busy button** shines its label instead.
 */
export function LogoLoader({
  size = 48,
  progress,
  tone = 'brand',
  tile = false,
  label = '',
  detail,
  inline = false,
}: LogoLoaderProps) {
  const theme = useTheme();
  const clipId = `ffl${useId().replace(/[^A-Za-z0-9_-]/g, '')}c`;

  const fill =
    progress === undefined ? null : Math.max(0, Math.min(1, progress));
  const inks: [Ink, Ink] =
    tone === 'current' ? ['current', 'current'] : ['text', 'accent'];
  const shown = detail ?? (fill === null ? '' : `${Math.round(fill * 100)}%`);
  const name = [label || 'Loading', shown].filter(Boolean).join(', ');
  const height = tile ? size : Math.round((size * 424) / 704);

  return (
    <Root role="status" aria-live="polite" aria-label={name} $inline={inline}>
      <MarkBox aria-hidden="true" style={{ width: size, height }}>
        <Svg
          viewBox={tile ? '0 0 1024 1024' : MARK_VIEWBOX}
          width={size}
          height={height}
        >
          {tile ? (
            <rect
              width={1024}
              height={1024}
              rx={225.28}
              fill={theme.colors.bg}
            />
          ) : null}
          {fill === null ? (
            <>
              <F d={MARK_F1} $ink={inks[0]} $beat={0} data-beat="" />
              <F d={MARK_F2} $ink={inks[1]} $beat={1} data-beat="" />
            </>
          ) : (
            <>
              <defs>
                <clipPath id={clipId}>
                  <ClipRect
                    x={174}
                    y={300}
                    width={676}
                    height={424}
                    style={{ transform: `scaleX(${fill})` }}
                  />
                </clipPath>
              </defs>
              <F d={MARK_F1} $ink={inks[0]} opacity={0.2} />
              <F d={MARK_F2} $ink={inks[1]} opacity={0.2} />
              <g clipPath={`url(#${clipId})`}>
                <F d={MARK_F1} $ink={inks[0]} />
                <F d={MARK_F2} $ink={inks[1]} />
              </g>
            </>
          )}
        </Svg>
      </MarkBox>
      {label ? (
        <Words aria-hidden="true">
          <Label>{label}</Label>
          {shown ? <Detail>{shown}</Detail> : null}
        </Words>
      ) : null}
    </Root>
  );
}
