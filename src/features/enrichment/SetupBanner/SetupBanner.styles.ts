import styled from 'styled-components';

/** One of the prototype's two setup banners. */
export type BannerTone = 'danger' | 'accent';

/**
 * The banner over the scope cards: the offline one in the danger tint, its
 * glyph top-aligned with the title; the key one on the accent-soft fill inside
 * the accent line, centred.
 */
export const Banner = styled.div<{ $tone: BannerTone }>`
  display: flex;
  align-items: ${({ $tone }) => ($tone === 'danger' ? 'flex-start' : 'center')};
  gap: 14px;
  padding: 16px 18px;
  background: ${({ $tone, theme }) =>
    $tone === 'danger' ? 'rgba(201, 122, 106, 0.1)' : theme.colors.accentSoft};
  border: 1px solid
    ${({ $tone, theme }) =>
      $tone === 'danger'
        ? 'rgba(201, 122, 106, 0.32)'
        : theme.colors.accentLine};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The danger banner's glyph, in the danger ink. */
export const BannerGlyph = styled.span`
  flex: 0 0 auto;
  margin-top: 1px;
  color: ${({ theme }) => theme.colors.danger};
`;

/** The banner's two lines, taking the width the glyph and button do not. */
export const BannerText = styled.div`
  flex: 1;
`;

export const BannerTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const BannerLine = styled.div`
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The banner's button, at its own width. */
export const BannerAction = styled.div`
  flex: 0 0 auto;
`;
