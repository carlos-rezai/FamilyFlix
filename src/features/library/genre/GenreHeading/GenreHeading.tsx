import { useGenreMovies } from '../GenreMovies/GenreMovies';
import { genreCountLabel } from '../genreCountLabel/genreCountLabel';
import { Name, Count } from './GenreHeading.styles';

/**
 * The header half of the genre screen: the genre's name over the count line it
 * holds — `page.GenrePage.dc.html`'s heading block.
 *
 * The name comes from the path, so it paints while the grid below is still a
 * skeleton; a screen that could not say which genre it was until its movies
 * arrived would be a blank strip over a loading shelf.
 *
 * The count line waits, because it cannot be honest before the payload lands:
 * the numbers it needs are the genre's real total and how many came back, and
 * printing "0 titles" until they do would claim an empty genre every time.
 */
export function GenreHeading() {
  const { status, genre, total, movies } = useGenreMovies();

  return (
    <>
      <Name>{genre}</Name>
      {status === 'ready' ? (
        <Count>{genreCountLabel(movies.length, total)}</Count>
      ) : null}
    </>
  );
}
