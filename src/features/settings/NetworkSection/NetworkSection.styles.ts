import styled from 'styled-components';

import { ItemDesc } from '../section.styles';

/** The watched green's tint and line, the Codec row's _Installed_ pair. */
const CONNECTED_TINT = 'rgba(138, 154, 107, 0.16)';
const CONNECTED_LINE = 'rgba(138, 154, 107, 0.3)';

/** The title block, 14px above the key row. */
export const Head = styled.div`
  margin-bottom: 14px;
`;

/** The card's title with its status pill beside it. */
export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

/**
 * The status pill: _Connected_ in the watched green on its tint, _Not set up_
 * in the faint ink on the third surface.
 */
export const StatusPill = styled.span<{ $connected: boolean }>`
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ $connected, theme }) =>
    $connected ? theme.colors.watched : theme.colors.textFaint};
  background: ${({ $connected, theme }) =>
    $connected ? CONNECTED_TINT : theme.colors.surface3};
  border: 1px solid
    ${({ $connected, theme }) =>
      $connected ? CONNECTED_LINE : theme.colors.border};
`;

/** The lede, at the prototype's wider measure and looser leading. */
export const Lede = styled(ItemDesc)`
  margin-top: 3px;
  max-width: 520px;
  line-height: 1.5;
  text-wrap: pretty;
`;

/** The key field and _Test connection_ on one line. */
export const KeyRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`;

/** The masked key field, in mono and spaced so the dots read as a key. */
export const KeyInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 14px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 9px;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  letter-spacing: 2px;
  outline: none;
`;

/** The hint under the key: where to get one, or where it is kept. */
export const KeyHint = styled.div`
  margin-bottom: 4px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
