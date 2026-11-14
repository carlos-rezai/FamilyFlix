import { Count, Heading } from './LibraryGridHeading.styles';

export interface LibraryGridHeadingProps {
  /** _All movies_ or _All series_. */
  title: string;
  /** The count line, worded by the body that knows what it counts. */
  count: string;
}

/**
 * The heading over a **Library tab**'s whole grid and the count line under
 * it, as `page.LibraryPage.dc.html` draws them. `MovieGrid` and `SeriesGrid`
 * draw it over their grids, and `SeriesRows` over an empty library.
 */
export function LibraryGridHeading({ title, count }: LibraryGridHeadingProps) {
  return (
    <>
      <Heading>{title}</Heading>
      <Count>{count}</Count>
    </>
  );
}
