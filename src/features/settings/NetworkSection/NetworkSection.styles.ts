import styled from 'styled-components';

import { Divider, ItemDesc } from '../section.styles';

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

/** The hairline above the sync row, at the prototype's own margins. */
export const SyncDivider = styled(Divider)`
  margin: 20px 0 4px;
`;

/** _Sync metadata & posters_: the whole row one bare button. */
export const SyncRow = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 15px 4px 4px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
`;

/** The sync glyph in its accent tile — the prototype's own 38px and 9px. */
export const SyncTile = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

/** The label and its line, taking the width the tile and chevron do not. */
export const SyncText = styled.span`
  flex: 1;
  min-width: 0;
`;

export const SyncLabel = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const SyncDesc = styled.span`
  display: block;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The chevron at the row's end, in the faintest ink. */
export const SyncChevron = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;
