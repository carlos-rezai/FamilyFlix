import { FolderIcon } from '@/primitives';
import type { LibraryTitle } from '@/types';
import { titleRowView } from '../titleRowView/titleRowView';
import {
  Badge,
  Dot,
  Heading,
  Meta,
  Path,
  Row,
  Separator,
  State,
  Text,
  Tile,
  Title,
  Unreachable,
  Year,
} from './TitleRow.styles';

export interface TitleRowProps {
  /** The title the row draws. */
  title: LibraryTitle;
}

/**
 * One **Title row** on the **Manage library page**, on the **Folder row**'s
 * furniture: the accent tile, the title and its year, the path in mono, the
 * badge, the files and the **Details state**'s dot — and, for a title whose
 * Library folder can't be read, the line in danger. Its words are
 * `titleRowView`'s.
 */
export function TitleRow({ title }: TitleRowProps) {
  const view = titleRowView(title);

  return (
    <Row>
      <Tile>
        <FolderIcon size={20} />
      </Tile>
      <Text>
        <Heading>
          <Title>{title.title}</Title>
          {view.year === null ? null : <Year>{view.year}</Year>}
        </Heading>
        <Path>{title.path}</Path>
        <Meta>
          <Badge>{view.badge}</Badge>
          <span>{view.files}</span>
          <Separator aria-hidden="true">·</Separator>
          <State>
            <Dot $tone={view.dot.tone} aria-hidden="true" />
            <span>{view.dot.label}</span>
          </State>
        </Meta>
        {view.unreachable === null ? null : (
          <Unreachable>{view.unreachable}</Unreachable>
        )}
      </Text>
    </Row>
  );
}
