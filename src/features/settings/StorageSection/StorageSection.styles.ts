import styled from 'styled-components';

import { Card } from '../section.styles';

/**
 * The Storage card stacks its two lines — the folder, then the space line —
 * on the prototype's 18px.
 */
export const StorageCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

/**
 * The folder line: the title over the path. `min-width: 0` is what lets the
 * path shrink to the card and take an ellipsis rather than widen it.
 */
export const Folder = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

export const FolderText = styled.div`
  min-width: 0;
`;

/**
 * The **Managed media directory**'s absolute path: mono at 13px in the faint
 * ink, on one line with an ellipsis when long.
 */
export const Path = styled.div`
  margin-top: 4px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** The space line: **Space used** in bold, _of movies_, the dot, the titles. */
export const SpaceLine = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The bytes, bold in the text ink. */
export const Bytes = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

/** The faint dot between the bytes and the titles. */
export const Dot = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;
