import { MARK_F1, MARK_F2, MARK_VIEWBOX } from '@/tokens';
import {
  Background,
  Mark,
  MarkF1,
  MarkF2,
  Root,
  SplashWordmark,
  WordmarkLayer,
  type WordmarkLanding,
} from './WelcomeSplash.styles';

export type { WordmarkLanding } from './WelcomeSplash.styles';

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
 * `landing`. It announces itself as a status, _Opening FamilyFlix_; every
 * drawn layer is `aria-hidden`.
 */
export function WelcomeSplash({
  scale,
  landing,
  handingOff,
}: WelcomeSplashProps) {
  return (
    <Root role="status" aria-label="Opening FamilyFlix">
      <Background aria-hidden="true" $handingOff={handingOff} />
      <Mark
        aria-hidden="true"
        viewBox={MARK_VIEWBOX}
        $scale={scale}
        $handingOff={handingOff}
      >
        <MarkF1 d={MARK_F1} />
        <MarkF2 d={MARK_F2} />
      </Mark>
      <WordmarkLayer
        aria-hidden="true"
        $scale={scale}
        $landing={handingOff ? landing : null}
      >
        <SplashWordmark />
      </WordmarkLayer>
    </Root>
  );
}
