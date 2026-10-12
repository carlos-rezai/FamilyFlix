import styled from 'styled-components';

/**
 * The key badge — _TMDB connected_ in the watched green, _No key yet_ in the
 * faintest ink on the third surface — the prototype's `keyBadgeStyle`.
 */
export const KeyBadge = styled.span<{ $connected: boolean }>`
  flex: 0 0 auto;
  padding: 5px 12px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ $connected, theme }) =>
    $connected ? theme.colors.watched : theme.colors.textFaint};
  background: ${({ $connected, theme }) =>
    $connected ? 'rgba(138, 154, 107, 0.16)' : theme.colors.surface3};
  border: 1px solid
    ${({ $connected, theme }) =>
      $connected ? 'rgba(138, 154, 107, 0.3)' : theme.colors.border};
`;
