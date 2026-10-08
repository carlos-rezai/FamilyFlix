import styled from 'styled-components';

/**
 * _What the scanner accepts_: the soft-bordered bg2 panel between the root
 * field and the button, its glyph in a fixed column beside the text.
 */
export const Accepts = styled.div`
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: 10px;
`;

/** The glyph's column, in the faint ink, nudged 1px down onto the heading. */
export const AcceptsGlyph = styled.span`
  flex: 0 0 auto;
  display: flex;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 1px;
`;

/** The text column. */
export const AcceptsBody = styled.span`
  flex: 1;
  min-width: 0;
`;

/** The panel's heading: 13px semibold in the dim ink. */
export const AcceptsHeading = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 6px;
`;

/** The three shapes: 12px mono at 1.8, one to a line. */
export const AcceptsShapes = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  line-height: 1.8;
`;

/** The folder-first rule: 13px sans, 8px under the shapes. */
export const AcceptsRule = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 8px;
  line-height: 1.5;
  text-wrap: pretty;
`;

/** A run of the sans face inside the mono shapes: the loose shape's note. */
export const Sans = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
`;

/** A run of the mono face inside the sans rule: an Episode tag. */
export const Mono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
`;
