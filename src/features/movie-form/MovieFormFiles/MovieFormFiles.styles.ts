import styled from 'styled-components';

/**
 * The Files card — the panel the prototype draws under the metadata fields, on
 * the surface colour rather than the sheet's, so the slots read as one group
 * separate from the boxes above them.
 */
export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: ${({ theme }) => theme.space.s5};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The card's caption — small, spaced and uppercase, as the prototype sets it. */
export const Caption = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;
