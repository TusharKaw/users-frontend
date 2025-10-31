import Link from 'next/link';
import Image from 'next/image';
import { MediaWikiPage } from '@/lib/mediawiki';

interface PageCardProps {
  page: MediaWikiPage;
}

export default function PageCard({ page }: PageCardProps) {
  const slug = encodeURIComponent(page.title.replace(/\s+/g, '_'));

  return (
    <Link href={`/${slug}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        <div className="flex">
          {page.thumbnail && (
            <div className="relative w-32 h-32 flex-shrink-0">
              <Image
                src={page.thumbnail.source}
                alt={page.title}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          )}
          <div className="flex-1 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-primary-600 transition-colors">
              {page.title}
            </h3>
            {page.extract && (
              <p className="text-gray-600 text-sm line-clamp-3">
                {page.extract}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

