import { HomeRows } from '@/features/library/HomeRows/HomeRows';
import { LibrarySearch } from '@/features/search/LibrarySearch/LibrarySearch';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * The browse home (`/`) — the screen the family lands on. Composition only:
 * the page chrome from `MainLayout`, the search box in its header slot, the
 * home rows from the library feature.
 *
 * It holds no query of its own. The search box only writes the URL and the
 * rows only read it, so the two subtrees never speak to each other and there
 * is nothing here to lift.
 */
export default function LibraryPage() {
  return (
    <MainLayout headerStart={<LibrarySearch />}>
      <HomeRows />
    </MainLayout>
  );
}
