import styled from 'styled-components';

export const Track = styled.div<{ $height: number; $track: boolean }>`
  position: relative;
  width: 100%;
  height: ${({ $height }) => $height}px;
  background: ${({ $track }) =>
    $track ? 'rgba(0, 0, 0, 0.45)' : 'transparent'};
  border-radius: ${({ $height }) => ($height >= 6 ? '999px' : '0')};
  overflow: hidden;
`;

export const Fill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.accent};
  border-radius: inherit;
  transition: width 0.2s ease;
`;

export const IndeterminateFill = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  background: ${({ theme }) => theme.colors.accent};
  border-radius: inherit;
  animation: ffIndeterminate 1.25s ease-in-out infinite;
`;
