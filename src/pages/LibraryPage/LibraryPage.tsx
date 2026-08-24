import { HomeRows } from '@/features/library/home/HomeRows/HomeRows';
import { LibraryFilters } from '@/features/search/LibraryFilters/LibraryFilters';
import { LibrarySearch } from '@/features/search/LibrarySearch/LibrarySearch';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * The browse home (`/`) — the screen the family lands on. Composition only:
 * the page chrome from `MainLayout`, the search box and the filter pills in
 * its two header slots, the home rows from the library feature.
 *
 * It holds no query of its own. The header controls only write the URL and the
 * rows only read it, so the two subtrees never speak to each other and there
 * is nothing here to lift.
 */
export default function LibraryPage() {
  return (
    <MainLayout headerStart={<LibrarySearch />} headerEnd={<LibraryFilters />}>
      <HomeRows />
    </MainLayout>
  );
}
