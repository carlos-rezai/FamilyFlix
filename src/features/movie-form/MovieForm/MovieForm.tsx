import { RatingPicker } from '@/components';
import {
  Button,
  ChevronLeftIcon,
  IconButton,
  Textarea,
  TextField,
} from '@/primitives';
import { GenrePicker } from '../GenrePicker/GenrePicker';
import { MovieFormFiles } from '../MovieFormFiles/MovieFormFiles';
import { useGenrePool } from '../useGenrePool/useGenrePool';
import { useMovieForm } from '../useMovieForm/useMovieForm';
import {
  Banner,
  BannerLead,
  BannerTitle,
  HeaderRow,
  Heading,
  Lede,
  Emphasis,
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

/**
 * What the screen calls itself, and what Save says on it, on two independent
 * axes. The **heading** is the job's alone: an add — with or without the
 * import's head start — is "Add a movie", and an amendment — a movie the
 * library already holds, whether opened from its page or from the review's
 * soft `missing-meta` row — is "Edit details". The **Save pair** is the
 * context's first: in **Import context** it says what it does to the run,
 * and outside it the job's own, plus what each says while the write is in
 * flight.
 *
 * The whole of what the maintainer sees of the difference between the jobs
 * and the contexts is here: one URL, one component, and a heading and a
 * button that say which is in front of them.
 */
const HEADING = {
  add: 'Add a movie',
  edit: 'Edit details',
} as const;

const SAVE = {
  add: { save: 'Add to library', saving: 'Adding…' },
  edit: { save: 'Save changes', saving: 'Saving…' },
  import: { save: 'Save & continue', saving: 'Saving…' },
} as const;

/** The other way out, and the one the gate never closes. */
const CANCEL_LABEL = 'Cancel';

/** The other way out in the **Import context**: the review row's own Skip. */
const SKIP_LABEL = 'Skip this one';

/** What the accent banner says before the problem's title. */
const RESOLVING_LEAD = 'Resolving import';

/**
 * What the banner says after the title of an `ambiguous` problem, before the
 * other folders the run was weighing — the prototype's fixed phrasing.
 */
const ALSO_MATCHED_LEAD = ' — also matched: ';

/**
 * The **Movie form** — `feat.MovieForm.dc.html`, and the only screen in the app
 * that writes a whole record.
 *
 * **One screen, three jobs.** With no `?movie=` it creates a record; with one it
 * amends the record that id names; with `?problem=` it resolves a flagged row
 * of the **Current run** — the **Import context**, under the accent banner the
 * prototype draws above the heading. There is no second component and no
 * `/edit` route: what changes between the contexts is the banner, the heading,
 * the two buttons' labels and where a finished save lands, and all but the
 * last of those are the whole of what is decided here.
 *
 * It renders the form and nothing else — the sheet it sits on is
 * `MaintainerLayout`'s, composed by the page — and what may be typed, what is
 * in the **File slots**, whether Save can be pressed, which job this is and
 * where a finished save lands all belong to `useMovieForm`.
 *
 * **Cancel and the back pill are one behaviour, not two** — both are the hook's
 * exits, so there are not two ways out of this screen that could drift apart,
 * and neither writes anything: a maintainer who leaves a half-filled form
 * leaves with it. The **Import context** is where they part: _Skip this one_
 * dismisses the problem on its way to the review, and Back dismisses nothing.
 */
export function MovieForm() {
  const genrePool = useGenrePool();
  const {
    values,
    setTitle,
    setYear,
    setDirector,
    setCast,
    setDescription,
    toggleGenre,
    setRating,
    pickVideo,
    removeVideo,
    pickPoster,
    removePoster,
    addSubtitle,
    changeSubtitleLanguage,
    removeSubtitle,
    canSave,
    saving,
    editing,
    resolving,
    save,
    back,
    cancel,
  } = useMovieForm();

  const heading = HEADING[editing ? 'edit' : 'add'];
  const copy = SAVE[resolving !== null ? 'import' : editing ? 'edit' : 'add'];

  return (
    <>
      {/* The prototype's own place for it: above the heading, on the accent,
        and only while a problem is being resolved. */}
      {resolving !== null && (
        <Banner>
          <BannerLead>{RESOLVING_LEAD}</BannerLead>{' '}
          <BannerTitle>
            · {resolving.title}
            {resolving.alsoMatched.length > 0 &&
              `${ALSO_MATCHED_LEAD}${resolving.alsoMatched.join(', ')}`}
          </BannerTitle>
        </Banner>
      )}

      <HeaderRow>
        <IconButton
          label="Back"
          title="Back"
          size={42}
          variant="outline"
          onClick={back}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <Heading>{heading}</Heading>
      </HeaderRow>

      <Lede>
        Pick the video, poster, and any subtitle files for this movie. To add
        many at once, use <Emphasis>Import library</Emphasis>.
      </Lede>

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

        <ChipField>
          <FieldLabel>
            Your rating <FieldHint>— click a star (or half)</FieldHint>
          </FieldLabel>
          {/* The percent goes straight in and straight back out: the strip
            speaks the scale the form holds, so there is nothing to convert
            until the wire. Clicking the segment holding the value hands
            back `null`, which is how a rating is removed everywhere in the
            app. */}
          <UnderCaption>
            <RatingPicker value={values.rating} onChange={setRating} />
          </UnderCaption>
        </ChipField>

        {/* The prototype's own place for it: under every metadata field, on a
          card of its own. */}
        <MovieFormFiles
          video={values.video}
          onPickVideo={pickVideo}
          onRemoveVideo={removeVideo}
          poster={values.poster}
          onPickPoster={pickPoster}
          onRemovePoster={removePoster}
          subtitles={values.subtitles}
          onAddSubtitle={addSubtitle}
          onChangeSubtitleLanguage={changeSubtitleLanguage}
          onRemoveSubtitle={removeSubtitle}
        />
      </Fields>

      <Actions>
        {/* The label is the whole of the in-flight state: it says the work
          started, and the disabled button is what stops an impatient second
          press writing a second row. */}
        <Button
          label={saving ? copy.saving : copy.save}
          variant="primary"
          size="md"
          disabled={!canSave}
          onClick={save}
        />
        <Button
          label={resolving !== null ? SKIP_LABEL : CANCEL_LABEL}
          variant="secondary"
          size="md"
          onClick={cancel}
        />
      </Actions>
    </>
  );
}
