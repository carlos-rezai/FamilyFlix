import styled from 'styled-components';

/**
 * The caption _Link or copy_, drawn as the Settings **Group heading** is — small caps
 * in the faintest ink, nudged 2px in — since _Link or copy_ labels a section, not one
 * input. Its own copy: a molecule draws no feature's furniture.
 */
export const GroupHeading = styled.div`
  margin: 0 0 ${({ theme }) => theme.space.s3} 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The two cards side by side, 10px apart. */
export const Cards = styled.div`
  display: flex;
  gap: 10px;
`;
