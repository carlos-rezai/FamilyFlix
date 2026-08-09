import styled from 'styled-components';

/**
 * The whole tile is one control, so it is a real `<button>` rather than a div
 * with a click handler: that is what makes it a tab stop and what gets Enter
 * and Space handled by the browser instead of by us. The tile holds nothing
 * else interactive, so there is no nested-control problem to work around.
 *
 * Everything above `width` is undoing the UA's button styling, so the rendered
 * pixels are the same as the div's were: buttons come with a border, a padded
 * grey background, a centred text alignment that would shift the title and
 * resume label inside their absolutely-positioned wrapper, and their own font.
 * The focus ring is deliberately left alone — it is the visible half of what
 * this change is for.
 */
export const Root = styled.button`
  appearance: none;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  display: block;
  width: 100%;
  cursor: pointer;

  &:hover {
    opacity: 0.94;
  }
`;

export const Tile = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
`;

export const Art = styled.div<{ $g1: string; $g2: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $g1, $g2 }) =>
    `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;

export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 35%,
    rgba(0, 0, 0, 0.78) 100%
  );
`;

export const TextWrap = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 14px;
`;

export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 18px;
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
`;

export const ResumeLabel = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
  margin-top: 2px;
`;

/**
 * Holds the accent fill against the tile's own lighter track. The `ProgressBar`
 * primitive's darkened track would disappear into the scrim here, so the tile
 * draws the track and the primitive renders fill-only (`track={false}`).
 */
export const TrackWrap = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.18);
`;

export const PlayBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(18, 14, 10, 0.55);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
`;
