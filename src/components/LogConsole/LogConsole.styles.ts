import styled from 'styled-components';

import type { LogKind } from '@/types';

/** The scrolling box: `bg` under a soft border, the height the caller sets. */
export const Box = styled.div<{ $height: number }>`
  height: ${({ $height }) => $height}px;
  overflow-y: auto;
  padding: ${({ theme }) => `${theme.space.s3} 14px`};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

/** One mono line, inked by its **Log kind**, wrapping anywhere a path makes it. */
export const Line = styled.div<{ $kind: LogKind }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-all;
  color: ${({ $kind, theme }) => {
    switch ($kind) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.danger;
      case 'scan':
        return theme.colors.textDim;
      case 'path':
      case 'info':
        return theme.colors.textFaint;
    }
  }};
`;
