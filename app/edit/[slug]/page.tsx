'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { editPage } from '@/lib/mediawiki';
import RevisionHistory from '@/components/RevisionHistory';
import PageProtection from '@/components/PageProtection';
import axios from 'axios';

interface EditPageProps {
  params: Promise<{ slug: string }>;
}

export default function EditPage({ params }: EditPageProps) {
  const router = useRouter();
  const [slug, setSlug] = useState<string>('');
  const [page, setPage] = useState<{ title: string; content?: string; pageid?: number } | null>(null);
  const [formData, setFormData] = useState<{ content: string }>({
    content: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string; realname?: string } | null>(null);

  useEffect(() => {
    // Get current user
    axios.get('/api/auth/user', {
      withCredentials: true,
    })
      .then((response) => {
        if (response.data.loggedIn && response.data.user) {
          setUser(response.data.user);
        } else {
          // Redirect to login if not logged in
          router.push('/login?redirect=/edit/' + encodeURIComponent(window.location.pathname.split('/').pop() || ''));
        }
      })
      .catch(() => {
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      });
  }, [router]);

  useEffect(() => {
    async function loadPage() {
      const resolvedParams = await params;
      const slugParam = decodeURIComponent(resolvedParams.slug.replace(/_/g, ' '));
      setSlug(slugParam);
      
      try {
        setIsLoading(true);
        
        // Fetch page content via API (client-side)
        const encodedSlug = encodeURIComponent(resolvedParams.slug);
        const response = await axios.get(`/api/articles/${encodedSlug}`);
        
        if (!response.data.success || !response.data.page) {
          setError('Page not found');
          setIsLoading(false);
          return;
        }
        
        const pageData = response.data.page;
        
        setPage({
          title: pageData.title,
          content: pageData.content || '',
          pageid: pageData.pageid,
        });
        
        // Debug: log content
        console.log('Page data loaded:', {
          title: pageData.title,
          hasContent: !!pageData.content,
          contentLength: pageData.content?.length || 0,
          contentPreview: pageData.content ? `${pageData.content.substring(0, 100)}...` : 'empty',
          contentValue: pageData.content || '',
        });
        
        // Set form data with content
        const contentToSet = pageData.content || '';
        setFormData({
          content: contentToSet,
        });
        
        console.log('Form data set with content length:', contentToSet.length);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading page:', err);
        setError('Failed to load page: ' + (err.message || 'Unknown error'));
        setIsLoading(false);
      }
    }
    
    loadPage();
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    if (!page) {
      setError('Page data not loaded');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await editPage(page.title, formData.content.trim());

      if (result.success) {
        // Navigate to the edited page
        const pageSlug = encodeURIComponent(page.title.replace(/\s+/g, '_'));
        window.location.href = `/${pageSlug}`;
      } else {
        setError(result.error || 'Failed to edit page. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while editing the page.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <p className="text-gray-600">Loading page...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <p className="text-red-600">{error || 'Page not found'}</p>
          <Link href="/" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`}
        className="text-primary-600 hover:text-primary-700 mb-4 inline-block"
      >
        ← Back to Article
      </Link>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Edit: {page.title}
        </h1>
        
        {user && (
          <p className="text-sm text-gray-600 mb-6">
            Editing as: <span className="font-medium">{user.realname || user.username}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content || ''}
              onChange={handleChange}
              required
              rows={20}
              placeholder={isLoading ? "Loading content... (You can use MediaWiki markup)" : "Enter MediaWiki markup content..."}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              disabled={isSubmitting || isLoading}
            />
            {!isLoading && formData.content && formData.content.trim().length > 0 && (
              <p className="mt-2 text-xs text-green-600">
                ✓ Content loaded: {formData.content.length} characters
              </p>
            )}
            {!isLoading && formData.content !== undefined && (!formData.content || formData.content.trim().length === 0) && (
              <p className="mt-2 text-sm text-yellow-600">
                ⚠️ No existing content found. This will create a new page or the content may be empty.
              </p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              You can use MediaWiki markup syntax in the content. Changes will be saved to the article.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={isSubmitting || !user}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        <PageProtection pageTitle={page.title} />

        <RevisionHistory pageTitle={page.title} />
      </div>
    </div>
  );
}

