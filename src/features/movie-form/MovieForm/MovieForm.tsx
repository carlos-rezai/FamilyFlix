import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { Button, ChevronLeftIcon, IconButton, TextField } from '@/primitives';
import { useMovieForm } from '../useMovieForm/useMovieForm';
import {
  Sheet,
  Column,
  HeaderRow,
  Heading,
  Fields,
  FieldRow,
  Field,
  NarrowField,
  FieldLabel,
  Actions,
} from './MovieForm.styles';

/** What Save says, and what it says instead while the write is in flight. */
const SAVE_LABEL = 'Add to library';
const SAVING_LABEL = 'Adding…';

/**
 * The **Movie form** in its **Add context** — `feat.MovieForm.dc.html`, and the
 * only screen in the app that creates a record rather than amending one.
 *
 * It renders the form and nothing else: what may be typed, whether Save can be
 * pressed and where a finished save lands all belong to `useMovieForm`, which is
 * also where the second half of the gate lands when there is a video slot for it
 * to check.
 *
 * **What of the prototype is deliberately not here yet**, so its absence reads as
 * a slice boundary rather than as a miss:
 *
 * - Director, Cast, Description, the genre chips and the rating picker — the rest
 *   of the metadata, and the Cancel button beside Save (issues #99 to #101).
 * - The Files panel, and with it the subtitle line under the heading: it reads
 *   "Pick the video, poster, and any subtitle files for this movie", which would
 *   be the screen describing three controls it does not have. It arrives with
 *   them (issues #102 to #104).
 * - The fields are `TextField` at its pill default rather than the prototype's
 *   48px/12px box: `height` and `rounded` are props that primitive's own styles
 *   file has been waiting to grow for this caller, and they arrive with the
 *   fields that need them (issue #100).
 */
export function MovieForm() {
  const goBack = useGoBack();
  const { values, setTitle, setYear, canSave, saving, save } = useMovieForm();

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
          <Heading>Add a movie</Heading>
        </HeaderRow>

        <Fields>
          <FieldRow>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <TextField
                value={values.title}
                placeholder="Movie title"
                aria-label="Title"
                onChange={setTitle}
              />
            </Field>
            <NarrowField>
              <FieldLabel>Year</FieldLabel>
              <TextField
                value={values.year}
                placeholder="2019"
                aria-label="Year"
                onChange={setYear}
              />
            </NarrowField>
          </FieldRow>
        </Fields>

        <Actions>
          {/* The label is the whole of the in-flight state: it says the work
              started, and the disabled button is what stops an impatient second
              press writing a second row. */}
          <Button
            label={saving ? SAVING_LABEL : SAVE_LABEL}
            variant="primary"
            size="md"
            disabled={!canSave}
            onClick={save}
          />
        </Actions>
      </Column>
    </Sheet>
  );
}
