import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

/**
 * The full-bleed art area behind the top of the page. It is sized against the
 * scroll container (`MoviePage`), not the content, so a movie with a ten-line
 * synopsis and one with two lines get identically-sized backdrops.
 */
export const ArtArea = styled.div`
  position: absolute;
  inset: 0;
  height: 62%;
  overflow: hidden;
`;

/** Real artwork, or the deterministic gradient the movie's card also draws. */
export const Art = styled.div<{
  $url: string | null;
  $g1: string;
  $g2: string;
}>`
  position: absolute;
  inset: 0;
  background: ${({ $url, $g1, $g2 }) =>
    $url
      ? `center / cover no-repeat url(${$url})`
      : `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;

/** Three stops, landing on the page background so the art has no bottom edge. */
export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(20, 17, 13, 0.45) 0%,
    rgba(20, 17, 13, 0.82) 55%,
    ${({ theme }) => theme.colors.bg} 100%
  );
`;

export const Content = styled.div`
  position: relative;
  z-index: 10;
  max-width: 1000px;
  margin: 0 auto;
  padding: ${({ theme }) => `130px ${theme.space.s6} ${theme.space.s8}`};
  display: flex;
  gap: ${({ theme }) => theme.space.s7};
  align-items: flex-start;
`;

export const PosterColumn = styled.div`
  flex: 0 0 300px;
`;

export const PosterFrame = styled.div`
  position: relative;
  width: 300px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

export const TopTag = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  top: 18px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
`;

export const PosterTitle = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 22px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 27px;
  line-height: 1.1;
  color: #fff;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.6);
`;

export const Main = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 6px;
`;

export const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  font-size: 48px;
  line-height: 1.04;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

export const MetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

export const MetaText = styled.span`
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textDim};
`;

export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const RatingWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
`;

export const WatchedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.watched};
  background: rgba(138, 154, 107, 0.14);
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

export const Genres = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

/**
 * The primary actions, directly under the genre chips and above the fold. The
 * two circular toggles land in this row beside Play with the next slice; the
 * gap and the wrap are already sized for them.
 */
export const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  flex-wrap: wrap;
`;

/**
 * The ⋯ trigger's fixed slot, mirroring the Back pill across the top of the
 * screen. It is the menu's positioned ancestor, and the box an outside
 * pointerdown is measured against — a press inside it is never "outside".
 */
export const MenuSlot = styled.div`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 30;
`;

/** Translucent over artwork, like the Back pill it sits opposite. */
export const MoreButton = styled.button`
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  background: rgba(20, 17, 13, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.textDim};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface2};
  }
`;

const pop = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Menu = styled.div`
  position: absolute;
  top: 52px;
  right: 0;
  min-width: 170px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 6px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
  animation: ${pop} 0.14s ease;
  z-index: 30;
`;

/** A real button, so the menu is operable by keyboard like everything else. */
export const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.text};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.surface3};
  }
`;

/** The item's leading glyph — decorative, so it stays out of the item's name. */
export const MenuGlyph = styled.span`
  font-size: 14px;
  line-height: 1;
`;

export const SynopsisWrap = styled.div`
  margin-top: 32px;
`;

export const Credits = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s7};
  margin-top: 28px;
  flex-wrap: wrap;
`;

export const Credit = styled.div`
  min-width: 0;
`;

/** The cast takes the leftover width; the director hugs its name. */
export const CastCredit = styled(Credit)`
  flex: 1 1 280px;
`;

export const CreditLabel = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 6px;
`;

export const CreditValue = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  color: ${({ theme }) => theme.colors.text};
`;

export const CastValue = styled(CreditValue)`
  line-height: 1.5;
`;

/** The centered message the two failure screens share, as `HomeRows` uses. */
export const Message = styled.div`
  position: relative;
  z-index: 10;
  text-align: center;
  padding: ${({ theme }) => `${theme.space.s8} ${theme.space.s6}`};
  color: ${({ theme }) => theme.colors.textFaint};
  font-family: ${({ theme }) => theme.fonts.sans};
`;

export const MessageTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 26px;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 8px;
`;

export const MessageBody = styled.div`
  font-size: 16px;
`;

export const MessageAction = styled.div`
  margin-top: ${({ theme }) => theme.space.s5};
`;

/** The way out of a movie that no longer exists — a real link, not a button. */
export const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  padding: 0 26px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const pulse = keyframes`
  from { opacity: 0.45; }
  to { opacity: 0.8; }
`;

/** Every skeleton block breathes on the same beat, as on the browse home. */
const Block = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.sm};
  animation: ${pulse} 1.1s ease-in-out infinite alternate;
`;

export const SkeletonPoster = styled(Block)`
  width: 300px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
`;

export const SkeletonTitle = styled(Block)`
  width: 60%;
  height: 44px;
`;

export const SkeletonMeta = styled(Block)`
  width: 240px;
  height: 20px;
  margin-top: 20px;
`;

export const SkeletonChips = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
`;

export const SkeletonChip = styled(Block)`
  width: 90px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

export const SkeletonLine = styled(Block)`
  width: 100%;
  max-width: 560px;
  height: 16px;
  margin-top: 14px;
`;
