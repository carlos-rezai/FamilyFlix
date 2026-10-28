import { useId } from 'react';
import { useTheme } from 'styled-components';

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

/** The two F paths of `docs/handoff/brand/familyflix-mark.svg`. */
const F1 =
  'M380.23 704.39L174.08 704.39L174.08 666.32L220.93 663.98Q220.93 654.61 220.93 645.82L220.93 377.59Q220.93 368.81 220.93 360.02L174.08 357.10L174.08 319.61L489.16 319.61L493.84 420.93L446.41 420.93L432.35 357.10L324.59 357.10Q324.59 367.64 324.59 377.59Q324.01 407.46 324.01 436.74L324.01 488.87L388.43 488.87L396.04 444.94L434.69 444.94L434.69 574.37L396.04 574.37L388.43 527.52L324.01 527.52L324.01 586.08Q324.01 615.95 324.59 645.24Q324.59 654.61 324.59 663.39L380.23 666.32';
const F2 =
  'M736.30 704.39L530.16 704.39L530.16 666.32L577.01 663.98Q577.01 654.61 577.01 645.82L577.01 377.59Q577.01 368.81 577.01 360.02L530.16 357.10L530.16 319.61L845.23 319.61L849.92 420.93L802.48 420.93L788.43 357.10L680.67 357.10Q680.67 367.64 680.67 377.59Q680.08 407.46 680.08 436.74L680.08 488.87L744.50 488.87L752.12 444.94L790.77 444.94L790.77 574.37L752.12 574.37L744.50 527.52L680.08 527.52L680.08 586.08Q680.08 615.95 680.67 645.24Q680.67 654.61 680.67 663.39L736.30 666.32';

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
 * stripped of what a `url(#...)` reference cannot carry. Never drawn inside a
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
          viewBox={tile ? '0 0 1024 1024' : '160 300 704 424'}
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
              <F d={F1} $ink={inks[0]} $beat={0} data-beat="" />
              <F d={F2} $ink={inks[1]} $beat={1} data-beat="" />
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
              <F d={F1} $ink={inks[0]} opacity={0.2} />
              <F d={F2} $ink={inks[1]} opacity={0.2} />
              <g clipPath={`url(#${clipId})`}>
                <F d={F1} $ink={inks[0]} />
                <F d={F2} $ink={inks[1]} />
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
