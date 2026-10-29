import { useId } from 'react';

import { MARK_F1, MARK_F2, MARK_VIEWBOX } from '@/tokens';
import {
  Background,
  Letter,
  LetterCell,
  LetterSweep,
  Mark,
  MarkF1,
  MarkF2,
  Root,
  SplashWordmark,
  SweepBand,
  SweepLayer,
  Word,
  WordmarkLayer,
  type WordmarkLanding,
} from './WelcomeSplash.styles';

export type { WordmarkLanding } from './WelcomeSplash.styles';

/** The sweep bands' colours, as `rgb()` channels. */
const ORANGE = '255,150,90';
const WHITE = '255,255,255';

/** A sweep band's gradient: clear, `rgb` at `peak` in the middle, clear. */
function BandGradient({
  id,
  rgb,
  peak,
}: {
  id: string;
  rgb: string;
  peak: number;
}) {
  return (
    <linearGradient id={id} x1={0} x2={1} y1={0} y2={0}>
      <stop offset={0} stopColor={`rgb(${rgb})`} stopOpacity={0} />
      <stop offset={0.5} stopColor={`rgb(${rgb})`} stopOpacity={peak} />
      <stop offset={1} stopColor={`rgb(${rgb})`} stopOpacity={0} />
    </linearGradient>
  );
}

/**
 * A word's letters, each rising in its own cell; `from` is the first's index
 * in the wordmark. With `sweep`, each is the glyph's transparent sweep copy.
 */
function Letters({
  word,
  from,
  sweep = false,
}: {
  word: string;
  from: number;
  sweep?: boolean;
}) {
  const flix = from > 0;
  return (
    <Word>
      {word.split('').map((ch, j) => (
        <LetterCell key={j} $i={from + j}>
          {sweep ? (
            <LetterSweep $i={from + j} $flix={flix}>
              {ch}
            </LetterSweep>
          ) : (
            <Letter $flix={flix}>{ch}</Letter>
          )}
        </LetterCell>
      ))}
    </Word>
  );
}

export interface WelcomeSplashProps {
  /** `min(innerWidth / 480, innerHeight / 270)`, read once at the start. */
  scale: number;
  /**
   * Where the wordmark lands, measured at the **Wordmark handoff**'s start;
   * `null` before it.
   */
  landing: WordmarkLanding | null;
  /** Whether the **Wordmark handoff** is running. */
  handingOff: boolean;
}

/**
 * The **Welcome splash**: the **Start-up splash**'s background, the FF mark
 * from the `brand` tokens and the wordmark (_Family_ in `text`, _Flix_ in
 * `accent`), sized by the geometry of log 55 Q13. In the handoff the mark
 * fades and shrinks, the background fades out and the wordmark glides onto
 * `landing`. Through the intro the Fs drop, the letters rise and a light
 * sweeps the mark (clipped to each F) and then each glyph. The clip and
 * gradient ids come from `useId`, stripped as `LogoLoader`'s are. It announces itself as a status, _Opening FamilyFlix_; every
 * drawn layer is `aria-hidden`.
 */
export function WelcomeSplash({
  scale,
  landing,
  handingOff,
}: WelcomeSplashProps) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const clip = [`ffc${id}1`, `ffc${id}2`];
  const gradient = [`ffg${id}1`, `ffg${id}2`];

  return (
    <Root role="status" aria-label="Opening FamilyFlix">
      <Background aria-hidden="true" $handingOff={handingOff} />
      <Mark
        aria-hidden="true"
        viewBox={MARK_VIEWBOX}
        $scale={scale}
        $handingOff={handingOff}
      >
        <defs>
          <clipPath id={clip[0]}>
            <path d={MARK_F1} />
          </clipPath>
          <clipPath id={clip[1]}>
            <path d={MARK_F2} />
          </clipPath>
          <BandGradient id={gradient[0]} rgb={ORANGE} peak={0.95} />
          <BandGradient id={gradient[1]} rgb={WHITE} peak={0.7} />
        </defs>
        <MarkF1 d={MARK_F1} $delay={0} />
        <MarkF2 d={MARK_F2} $delay={150} />
        {[0, 1].map((f) => (
          <g key={f} clipPath={`url(#${clip[f]})`}>
            <SweepBand
              x={160}
              y={300}
              width={220}
              height={424}
              fill={`url(#${gradient[f]})`}
            />
          </g>
        ))}
      </Mark>
      <WordmarkLayer
        aria-hidden="true"
        $scale={scale}
        $landing={handingOff ? landing : null}
      >
        <SplashWordmark>
          <Letters word="Family" from={0} />
          <Letters word="Flix" from={6} />
        </SplashWordmark>
        <SweepLayer>
          <Letters word="Family" from={0} sweep />
          <Letters word="Flix" from={6} sweep />
        </SweepLayer>
      </WordmarkLayer>
    </Root>
  );
}
