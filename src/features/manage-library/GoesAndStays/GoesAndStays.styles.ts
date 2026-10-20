import styled from 'styled-components';

/** _What goes_ beside _What stays_, two even columns. */
export const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
`;

/** A list's heading: 12px, 700, uppercase and tracked; danger over What goes. */
export const ListHeading = styled.div<{ $goes: boolean }>`
  margin-bottom: 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme, $goes }) =>
    $goes ? theme.colors.danger : theme.colors.textFaint};
`;

/** The list under it: each line led by the handoff's ✕ or ✓. */
export const List = styled.ul<{ $goes: boolean }>`
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  line-height: 1.45;
  color: ${({ theme, $goes }) =>
    $goes ? theme.colors.text : theme.colors.textDim};

  li {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }

  li::before {
    content: '${({ $goes }) => ($goes ? '✕' : '✓')}';
    color: ${({ theme, $goes }) =>
      $goes ? theme.colors.danger : theme.colors.success};
  }
`;
