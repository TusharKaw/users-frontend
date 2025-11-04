import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getArticle } from '@/lib/mediawiki';
import RatingStars from '@/components/RatingStars';
import CommentSection from '@/components/CommentSection';
import Link from 'next/link';
import EditButton from '@/components/EditButton';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam.replace(/_/g, ' '));
  const page = await getArticle(slug);

  if (!page || page.pageid === undefined) {
    notFound();
  }

  const imageUrl = page.original?.source || page.thumbnail?.source;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="text-primary-600 hover:text-primary-700 mb-4 inline-block"
      >
        ← Back to Home
      </Link>

      <article className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-gray-900">
              {page.title}
            </h1>
            <EditButton pageTitle={page.title} />
          </div>

          {imageUrl && (
            <div className="relative w-full h-64 md:h-96 mb-6 rounded-lg overflow-hidden">
              <Image
                src={imageUrl}
                alt={page.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1024px"
                priority
              />
            </div>
          )}

          {page.extract && (
            <div
              className="prose prose-lg max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: page.extract }}
            />
          )}

          {!page.extract && (
            <p className="text-gray-600 italic">
              No content available for this article.
            </p>
          )}
        </div>
      </article>

      <RatingStars pageId={page.pageid} pageTitle={page.title} />

      <CommentSection pageId={page.pageid} pageTitle={page.title} />
    </div>
  );
}

