import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  Button,
  ChevronLeftIcon,
  IconButton,
  Textarea,
  TextField,
} from '@/primitives';
import { GenrePicker } from '../GenrePicker/GenrePicker';
import { useGenrePool } from '../useGenrePool/useGenrePool';
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
  WideField,
  ChipField,
  FieldLabel,
  FieldHint,
  UnderCaption,
  Actions,
} from './MovieForm.styles';

/**
 * The box the prototype draws every field on this form in — 48px tall with a
 * soft corner, rather than the 46px pill the search bar wears. Written once and
 * spread onto each field, because they are all the same box.
 */
const FIELD_BOX = { height: 48, rounded: false } as const;

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
 * - The rating picker, and the Cancel button beside Save (issue #101).
 * - The Files panel, and with it the subtitle line under the heading: it reads
 *   "Pick the video, poster, and any subtitle files for this movie", which would
 *   be the screen describing three controls it does not have. It arrives with
 *   them (issues #102 to #104).
 */
export function MovieForm() {
  const goBack = useGoBack();
  const genrePool = useGenrePool();
  const {
    values,
    setTitle,
    setYear,
    setDirector,
    setCast,
    setDescription,
    toggleGenre,
    canSave,
    saving,
    save,
  } = useMovieForm();

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
                {...FIELD_BOX}
                value={values.title}
                placeholder="Movie title"
                aria-label="Title"
                onChange={setTitle}
              />
            </Field>
            <NarrowField>
              <FieldLabel>Year</FieldLabel>
              <TextField
                {...FIELD_BOX}
                value={values.year}
                placeholder="2019"
                aria-label="Year"
                onChange={setYear}
              />
            </NarrowField>
          </FieldRow>

          <FieldRow>
            <Field>
              <FieldLabel>Director</FieldLabel>
              <TextField
                {...FIELD_BOX}
                value={values.director}
                placeholder="Director name"
                aria-label="Director"
                onChange={setDirector}
              />
            </Field>
            <Field>
              <FieldLabel>
                Cast <FieldHint>— separate with commas</FieldHint>
              </FieldLabel>
              {/* The line is held exactly as it is typed, comma by comma. It is
                  resolved into names once, on the way out — a field that tidied
                  itself while it was being typed into would delete the comma
                  just pressed. */}
              <TextField
                {...FIELD_BOX}
                value={values.cast}
                placeholder="e.g. Jane Doe, John Roe"
                aria-label="Cast"
                onChange={setCast}
              />
            </Field>
          </FieldRow>

          <WideField>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={values.description}
              placeholder="A short synopsis of the movie"
              aria-label="Description"
              onChange={setDescription}
            />
          </WideField>

          <ChipField>
            <FieldLabel>
              Genre <FieldHint>— pick one or more</FieldHint>
            </FieldLabel>
            {/* An empty pool draws an empty row: a broken endpoint is a caption
                with nothing under it, and a form that still saves. */}
            <UnderCaption>
              <GenrePicker
                genres={genrePool}
                selected={values.genres}
                onToggle={toggleGenre}
              />
            </UnderCaption>
          </ChipField>
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
