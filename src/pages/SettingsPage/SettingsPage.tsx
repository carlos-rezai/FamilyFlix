import { useNavigate } from 'react-router-dom';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import {
  Sheet,
  Column,
  HeaderRow,
  Heading,
  AddMovieButton,
  AddGlyph,
  Subtitle,
} from './SettingsPage.styles';

/**
 * `/settings` — the **Maintainer**'s hub, and the one door to every maintainer
 * surface in the app: the header gear is the only way in here, and ＋ Add a movie
 * is the only way from here to the **Movie form**. Nothing the **Family** sees on
 * the browse home leads to either.
 *
 * Four elements, and nothing below them. The grouped Library / Playback / Storage
 * / About sections belong to the settings-shell initiative; this header ships
 * with the movie form because without it the form is reached by typing `/add`
 * into the address bar, and a tracer bullet has to be the real path.
 *
 * Composition and its own chrome, which is what a screen that drops `MainLayout`
 * owns instead — `MoviePage`'s shape, for the reason recorded in the styles.
 */
export default function SettingsPage() {
  const goBack = useGoBack();
  const navigate = useNavigate();

  return (
    <Sheet>
      <Column>
        <HeaderRow>
          <IconButton
            label="Back"
            title="Back"
            size={42}
            variant="outline"
            onClick={goBack}
          >
            <ChevronLeftIcon size={18} />
          </IconButton>
          <Heading>Settings</Heading>
          <AddMovieButton type="button" onClick={() => navigate('/add')}>
            <AddGlyph aria-hidden="true">＋</AddGlyph>
            Add a movie
          </AddMovieButton>
        </HeaderRow>
        <Subtitle>Manage your library, playback, and storage.</Subtitle>
      </Column>
    </Sheet>
  );
}
