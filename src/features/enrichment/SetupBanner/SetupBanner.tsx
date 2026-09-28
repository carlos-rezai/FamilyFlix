import { BangRingIcon, Button } from '@/primitives';
import {
  Banner,
  BannerAction,
  BannerGlyph,
  BannerLine,
  BannerText,
  BannerTitle,
  type BannerTone,
} from './SetupBanner.styles';

export interface SetupBannerProps {
  /** `danger` — the offline banner; `accent` — the key banner. */
  tone: BannerTone;
  title: string;
  line: string;
  /** The button's label: _Retry_ on the danger tone, a primary on the accent. */
  actionLabel: string;
  onAction: () => void;
}

/**
 * The **Setup step**'s banner, 1:1 with `feat.EnrichmentFlow.dc.html`'s two:
 * the offline one in the danger tint with its 20px glyph and a secondary
 * button, and the key one on the accent-soft fill with no glyph and a primary
 * one. Presentational to the last prop — it does not know why it is drawn.
 */
export function SetupBanner({
  tone,
  title,
  line,
  actionLabel,
  onAction,
}: SetupBannerProps) {
  return (
    <Banner $tone={tone}>
      {tone === 'danger' ? (
        <BannerGlyph>
          <BangRingIcon size={20} />
        </BannerGlyph>
      ) : null}
      <BannerText>
        <BannerTitle>{title}</BannerTitle>
        <BannerLine>{line}</BannerLine>
      </BannerText>
      <BannerAction>
        <Button
          label={actionLabel}
          variant={tone === 'danger' ? 'secondary' : 'primary'}
          size="md"
          onClick={onAction}
        />
      </BannerAction>
    </Banner>
  );
}
