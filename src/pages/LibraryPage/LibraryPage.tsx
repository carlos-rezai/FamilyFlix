import { LibraryBody } from '@/features/library/LibraryBody/LibraryBody';
import { LibraryTabs } from '@/features/library/LibraryTabs/LibraryTabs';
import { LibraryFilters } from '@/features/search/LibraryFilters/LibraryFilters';
import { LibrarySearch } from '@/features/search/LibrarySearch/LibrarySearch';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * The browse home (`/`) — the screen the family lands on. Composition only:
 * the page chrome from `MainLayout`, the Movies / Series switch and the search
 * box in the start slot, the filter pills in the end slot, and the body the
 * library feature picks off `tab`.
 *
 * It holds no query of its own. The header controls only write the URL and the
 * rows only read it, so the two subtrees never speak to each other and there
 * is nothing here to lift.
 */
export default function LibraryPage() {
  return (
    <MainLayout
      headerStart={
        <>
          <LibraryTabs />
          <LibrarySearch />
        </>
      }
      headerEnd={<LibraryFilters />}
    >
      <LibraryBody />
    </MainLayout>
  );
}
