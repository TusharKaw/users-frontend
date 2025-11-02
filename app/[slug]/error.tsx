'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Article page error:', error);
  }, [error]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="text-primary-600 hover:text-primary-700 mb-4 inline-block"
      >
        ← Back to Home
      </Link>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-red-600 mb-4">
          Error Loading Article
        </h1>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <p className="text-red-800 mb-4">
            {error.message || 'An error occurred while loading the article.'}
          </p>

          {error.message?.includes('database connection') && (
            <div className="mt-4">
              <p className="text-sm text-red-700 mb-2">
                This appears to be a MediaWiki database connection issue. Please check:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                <li>That MediaWiki is running at http://localhost:8000</li>
                <li>That MediaWiki's database is properly configured</li>
                <li>That MediaWiki can access its database</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

