import { useNavigate } from 'react-router-dom';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import {
  HeaderRow,
  Heading,
  AddMovieButton,
  AddGlyph,
  Subtitle,
} from './SettingsHeader.styles';

/**
 * The header of the **Maintainer**'s hub, from `page.SettingsPage.dc.html`:
 * the back pill, the heading, ＋ Add a movie, and the line under them.
 *
 * It is the one door to every maintainer surface in the app — the header gear
 * is the only way to Settings, and ＋ Add a movie is the only way from here to
 * the **Movie form**. Nothing the **Family** sees on the browse home leads to
 * either.
 *
 * An organism rather than the page's own markup: a heading, an action that
 * opens another screen and a navigation are content and a decision, and a
 * page is composition only. The grouped Library / Playback / Storage / About
 * sections belong to the settings-shell initiative and will sit under this in
 * the same folder; this header shipped with the movie form because without it
 * the form is reached by typing `/add` into the address bar, and a tracer
 * bullet has to be the real path.
 */
export function SettingsHeader() {
  const goBack = useGoBack();
  const navigate = useNavigate();

  return (
    <>
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
    </>
  );
}
