import styled, { css } from 'styled-components';

import { visuallyHidden } from '@/styles/visuallyHidden';

/**
 * The dashed box under the rows, `feat.CodecManager.dc.html` → the zone: the
 * glyph, the title and the line, centred in 22px of padding behind a 1.5px
 * dashed border.
 *
 * It is a `<label>` rather than the prototype's `<button>`, for the
 * `FilePicker`'s reason: a press has to open a file dialog, and only a real
 * `<input type="file">` can — so the control the maintainer presses *is* the
 * input's label. Everything else about it is the prototype's.
 *
 * `$over` is the prototype's own hover face, drawn while a drag is over the
 * zone; `$busy` is `zoneWrapStyle` while a write is in flight — no pointer,
 * and no hover to invite a second drop that would report nothing.
 */
export const Zone = styled.label<{ $over: boolean; $busy: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 22px;
  background-color: ${({ theme, $over }) =>
    $over ? theme.colors.accentSoft : 'transparent'};
  border: 1.5px dashed
    ${({ theme, $over }) =>
      $over ? theme.colors.accentLine : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: ${({ $busy }) => ($busy ? 'default' : 'pointer')};

  ${({ $busy }) =>
    $busy
      ? css`
          pointer-events: none;
        `
      : css`
          &:hover {
            background-color: ${({ theme }) => theme.colors.accentSoft};
            border-color: ${({ theme }) => theme.colors.accentLine};
          }
        `}
`;

/** The arrow, in the prototype's accent rather than the zone's own ink. */
export const Glyph = styled.span`
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.accent};
`;

/** _Add a codec pack_ — 14px semibold, and the one line that never moves. */
export const Title = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The second line, 12.5px: the invitation, what is happening, or — in the
 * danger ink, the Setup step's line in this slot — why the last attempt was
 * refused.
 */
export const Line = styled.span<{ $refused: boolean }>`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12.5px;
  color: ${({ theme, $refused }) =>
    $refused ? theme.colors.danger : theme.colors.textFaint};
`;

/** `ffmpeg` in the invitation, set apart the way the prototype sets it. */
export const Mono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
`;

/**
 * The input itself: invisible, and still named by the zone, still in the
 * accessibility tree, still in the tab order — the one way this control is
 * operated without a mouse.
 */
export const Input = styled.input`
  ${visuallyHidden}
`;
