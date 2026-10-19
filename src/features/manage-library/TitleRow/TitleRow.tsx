import { useNavigate } from 'react-router-dom';

import { Menu, MenuItem } from '@/components';
import { BinIcon, FolderIcon, IconButton, MoreIcon } from '@/primitives';
import type { LibraryTitle } from '@/types';
import { enrichPath, movieFormPath, moviePath, seriesPath } from '@/utils';
import { titleRowView } from '../titleRowView/titleRowView';
import {
  Actions,
  Badge,
  Chevron,
  Dot,
  EditTrigger,
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
  /** _Clear details_ in the ⋯ menu, handing the title over to be confirmed. */
  onClear: (title: LibraryTitle) => void;
}

/**
 * One **Title row** on the **Manage library page**, on the **Folder row**'s
 * furniture: the accent tile, the title and its year, the path in mono, the
 * badge, the files and the **Details state**'s dot — and, for a title whose
 * Library folder can't be read, the line in danger. Its words are
 * `titleRowView`'s. At its right edge, _Edit ▾_: _Edit details_ pushes the
 * **Movie form**'s edit, _Sync with TMDB_ the title's page and then its Sync,
 * **Started on arrival**. After it, ⋯: _Clear details_, disabled while the
 * **Details state** is `none`, since there is nothing to clear.
 */
export function TitleRow({ title, onClear }: TitleRowProps) {
  const view = titleRowView(title);
  const navigate = useNavigate();
  const isMovie = title.kind === 'movie';

  // Log 45's leaving, with a push where the add replaces: the title's page
  // goes under the flow, so Back lands on the title and Back again here.
  function sync() {
    navigate(isMovie ? moviePath(title.id) : seriesPath(title.id));
    navigate(
      enrichPath(
        isMovie
          ? { movie: title.id, start: true }
          : { series: title.id, start: true }
      )
    );
  }

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
      <Actions>
        <Menu
          trigger={(props) => (
            <EditTrigger {...props} type="button">
              Edit
              <Chevron aria-hidden="true">▾</Chevron>
            </EditTrigger>
          )}
        >
          <MenuItem
            glyph="✎"
            hint="Change the title, year and poster by hand"
            onSelect={() =>
              navigate(
                movieFormPath(
                  isMovie ? { movie: title.id } : { series: title.id }
                )
              )
            }
          >
            Edit details
          </MenuItem>
          <MenuItem
            glyph="⟳"
            hint="Fetch details and artwork again"
            onSelect={sync}
          >
            Sync with TMDB
          </MenuItem>
        </Menu>
        <Menu
          trigger={(props) => (
            <IconButton
              {...props}
              label={`More actions for “${title.title}”`}
              size={36}
              variant="ghost"
            >
              <MoreIcon size={18} />
            </IconButton>
          )}
        >
          <MenuItem
            glyph={<BinIcon size={16} />}
            disabled={title.details === 'none'}
            onSelect={() => onClear(title)}
          >
            Clear details
          </MenuItem>
        </Menu>
      </Actions>
    </Row>
  );
}
