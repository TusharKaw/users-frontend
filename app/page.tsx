import { Suspense } from 'react';
import PageCard from '@/components/PageCard';
import { getTopPages, searchPages, MediaWikiPage } from '@/lib/mediawiki';

interface HomePageProps {
  searchParams: Promise<{ search?: string }>;
}

async function ArticlesFeed({ searchQuery }: { searchQuery?: string }) {
  let pages: MediaWikiPage[] = [];

  if (searchQuery) {
    pages = await searchPages(searchQuery);
  } else {
    pages = await getTopPages(20);
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          {searchQuery
            ? `No articles found for "${searchQuery}"`
            : 'No articles available yet. Create your first page!'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {pages.map((page) => (
        <PageCard key={page.pageid} page={page} />
      ))}
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const searchQuery = params?.search;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {searchQuery ? `Search Results` : 'Trending Articles'}
        </h1>
        <p className="text-gray-600 text-lg">
          {searchQuery
            ? `Searching for: "${searchQuery}"`
            : 'Discover and review top-rated articles'}
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        }
      >
        <ArticlesFeed searchQuery={searchQuery} />
      </Suspense>
    </div>
  );
}

