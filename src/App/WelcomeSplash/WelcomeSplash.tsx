import { MARK_F1, MARK_F2, MARK_VIEWBOX } from '@/tokens';
import {
  Background,
  Mark,
  MarkF1,
  MarkF2,
  Root,
  SplashWordmark,
  WordmarkLayer,
} from './WelcomeSplash.styles';

export interface WelcomeSplashProps {
  /** `min(innerWidth / 480, innerHeight / 270)`, read once at the start. */
  scale: number;
  /** Whether the splash is fading out: the **Wordmark handoff**. */
  fading: boolean;
  /** How long that fade takes. */
  fadeMs: number;
}

/**
 * The **Welcome splash**, still: the **Start-up splash**'s background, the FF
 * mark from the `brand` tokens and the wordmark (_Family_ in `text`, _Flix_
 * in `accent`), sized by the geometry of log 55 Q13. It announces itself as
 * a status, _Opening FamilyFlix_; every drawn layer is `aria-hidden`.
 */
export function WelcomeSplash({ scale, fading, fadeMs }: WelcomeSplashProps) {
  return (
    <Root
      role="status"
      aria-label="Opening FamilyFlix"
      $fading={fading}
      $fadeMs={fadeMs}
    >
      <Background aria-hidden="true" />
      <Mark aria-hidden="true" viewBox={MARK_VIEWBOX} $scale={scale}>
        <MarkF1 d={MARK_F1} />
        <MarkF2 d={MARK_F2} />
      </Mark>
      <WordmarkLayer aria-hidden="true" $scale={scale}>
        <SplashWordmark />
      </WordmarkLayer>
    </Root>
  );
}
