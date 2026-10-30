import styled, {
  css,
  keyframes,
  type DefaultTheme,
  type Keyframes,
} from 'styled-components';

/** The media query the welcome reads, once at the start (log 55 Q15). */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Where the splash wordmark lands: the header wordmark's top-left and size. */
export interface WordmarkLanding {
  /** The header wordmark's `getBoundingClientRect()` left, in px. */
  left: number;
  /** Its top, in px. */
  top: number;
  /** The header's `font-size` over the splash's `30·scale`. */
  ratio: number;
}

/** The background's fade (the prototype's `ffOut`). */
const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

/** Under reduced motion the mark and wordmark fade in, nothing moving. */
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/**
 * A reduced-motion fade: `frames` over 300ms from the start. Its own
 * `prefers-reduced-motion` rule carries `!important` on a doubled class, so
 * `GlobalStyle`'s `*` collapse never freezes it (log 55 Q15): a fade, never
 * a cut.
 */
const stillFade = (frames: Keyframes, theme: DefaultTheme) => css`
  animation: ${frames} 300ms 0ms both ${theme.motion.easeOut};

  @media ${REDUCED_MOTION_QUERY} {
    && {
      animation: ${frames} 300ms 0ms both ${theme.motion.easeOut} !important;
    }
  }
`;

/** The mark fades and shrinks where it stands (`ffMarkOut`). */
const markOut = keyframes`
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
`;

/** The Fs drop in and settle (`ffDrop`). */
const drop = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-70%);
  }
  55% {
    opacity: 1;
    transform: translateY(5%);
  }
  75% {
    transform: translateY(-3%);
  }
  100% {
    opacity: 1;
    transform: none;
  }
`;

/** A letter rises and unblurs (`ffLetter`). */
const letterIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(60%);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
`;

/** A band crosses the mark, in viewBox units (`ffSweep`). */
const sweep = keyframes`
  from {
    transform: translateX(-260px);
  }
  to {
    transform: translateX(760px);
  }
`;

/** A band crosses a glyph (`ffTextSweep`). */
const textSweep = keyframes`
  from {
    background-position: 160% 0;
  }
  to {
    background-position: -60% 0;
  }
`;

/** The glide (`ffToHeader`), its end the measured header wordmark. */
const toHeader = (scale: number, { left, top, ratio }: WordmarkLanding) =>
  keyframes`
    from {
      left: 50%;
      top: calc(50% + ${42 * scale}px);
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      left: ${left}px;
      top: ${top}px;
      transform: translate(0, 0) scale(${ratio});
    }
  `;

/** The splash over the whole window, above the **Home layer**. */
export const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
`;

/**
 * The **Start-up splash**'s background: flat `bg`, so the two meet
 * seamlessly. In the handoff it fades out from 50ms for 400ms.
 */
export const Background = styled.div<{
  $handingOff: boolean;
  $still: boolean;
}>`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.bg};
  ${({ $handingOff, $still, theme }) =>
    $handingOff &&
    ($still
      ? stillFade(fadeOut, theme)
      : css`
          animation: ${fadeOut} 400ms 50ms both ${theme.motion.easeOut};
        `)}
`;

/**
 * The FF mark, `132·scale × 80·scale`, centred `26·scale` above the middle;
 * in the handoff it fades and shrinks over 300ms.
 */
export const Mark = styled.svg<{
  $scale: number;
  $handingOff: boolean;
  $still: boolean;
}>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% - ${26 * $scale}px)`};
  width: ${({ $scale }) => 132 * $scale}px;
  height: ${({ $scale }) => 80 * $scale}px;
  transform: translate(-50%, -50%);
  ${({ $handingOff, $still, theme }) => {
    if ($still) {
      return stillFade($handingOff ? fadeOut : fadeIn, theme);
    }
    return (
      $handingOff &&
      css`
        animation: ${markOut} 300ms 0ms both ${theme.motion.easeOut};
      `
    );
  }}
`;

/**
 * The **Welcome hold**'s `LogoLoader`, in the mark's place at its width; in
 * the handoff it fades and shrinks as the mark would.
 */
export const HoldMark = styled.div<{
  $scale: number;
  $handingOff: boolean;
  $still: boolean;
}>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% - ${26 * $scale}px)`};
  transform: translate(-50%, -50%);
  ${({ $handingOff, $still, theme }) =>
    $handingOff &&
    ($still
      ? stillFade(fadeOut, theme)
      : css`
          animation: ${markOut} 300ms 0ms both ${theme.motion.easeOut};
        `)}
`;

/**
 * An F drops from `$delay` ms for 520ms, about its own bottom middle; under
 * reduced motion (`$still`) it stands where it lands.
 */
const MarkF = styled.path<{ $delay: number; $still: boolean }>`
  transform-box: fill-box;
  transform-origin: 50% 100%;
  ${({ $delay, $still, theme }) =>
    !$still &&
    css`
      animation: ${drop} 520ms ${$delay}ms both ${theme.motion.easeDrop};
    `}
`;

export const MarkF1 = styled(MarkF)`
  fill: ${({ theme }) => theme.colors.text};
`;

export const MarkF2 = styled(MarkF)`
  fill: ${({ theme }) => theme.colors.accent};
`;

/** A 220-unit band over an F, swept from 1000ms for 700ms. */
export const SweepBand = styled.rect`
  animation: ${sweep} 700ms 1000ms both ${({ theme }) => theme.motion.easeSweep};
`;

/**
 * The wordmark's layer, centred `42·scale` below the middle. In the handoff
 * it glides about its top-left corner onto the header wordmark over 500ms.
 */
export const WordmarkLayer = styled.div<{
  $scale: number;
  $landing: WordmarkLanding | null;
  $still: boolean;
  $handingOff: boolean;
}>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% + ${42 * $scale}px)`};
  transform: translate(-50%, -50%);
  transform-origin: 0 0;
  font-size: ${({ $scale }) => 30 * $scale}px;
  line-height: normal;
  white-space: nowrap;
  ${({ $scale, $landing, $still, $handingOff, theme }) => {
    if ($still) {
      return stillFade($handingOff ? fadeOut : fadeIn, theme);
    }
    return (
      $landing !== null &&
      css`
        animation: ${toHeader($scale, $landing)} 500ms 0ms both
          ${theme.motion.easeGlide};
      `
    );
  }}
`;

/**
 * The wordmark, _Family_ run into _Flix_ in the brand's serif at 700, with
 * the header's typography (`LogoMark`'s 2px gap and 0.3px tracking at 25px)
 * carried to the splash's size, in `em` so it scales with the layer.
 */
export const SplashWordmark = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: ${2 / 25}em;
  letter-spacing: ${0.3 / 25}em;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
`;

/** The wordmark again, laid exactly over it: the glyphs' sweep copies. */
export const SweepLayer = styled(SplashWordmark)`
  position: absolute;
  inset: 0;
`;

/** One word of the wordmark: its letters in a row. */
export const Word = styled.span`
  display: inline-flex;
`;

/** Letter `$i`'s cell: it rises and unblurs from `520 + i·40` for 420ms. */
export const LetterCell = styled.span<{ $i: number; $still: boolean }>`
  position: relative;
  display: inline-block;
  ${({ $i, $still, theme }) =>
    !$still &&
    css`
      animation: ${letterIn} 420ms ${520 + $i * 40}ms both
        ${theme.motion.easeOut};
    `}
`;

/** A letter's glyph: _Family_ in `text`, _Flix_ in `accent`. */
export const Letter = styled.span<{ $flix: boolean }>`
  color: ${({ $flix, theme }) =>
    $flix ? theme.colors.accent : theme.colors.text};
`;

/** The prototype's sweep band: `rgb` peaking at `peak` in the middle. */
const band = (rgb: string, peak: number) =>
  `linear-gradient(100deg, rgba(${rgb},0) 30%, rgba(${rgb},${peak}) 50%, rgba(${rgb},0) 70%)`;

/**
 * A glyph's transparent copy, over it in the `SweepLayer`, its background
 * clipped to the text: a 100° band 300% wide, orange over _Family_ and white
 * over _Flix_, swept from `1150 + i·45` for 380ms linear. The band is painted
 * once, never repeated: a tiled 300% band rests on the glyph's edge before
 * and after its run.
 */
export const LetterSweep = styled.span<{ $i: number; $flix: boolean }>`
  color: transparent;
  background-image: ${({ $flix }) =>
    $flix ? band('255,255,255', 0.9) : band('255,150,90', 1)};
  background-size: 300% 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  animation: ${textSweep} 380ms ${({ $i }) => 1150 + $i * 45}ms both linear;
`;
