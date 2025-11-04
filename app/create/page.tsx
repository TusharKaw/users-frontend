'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPage } from '@/lib/mediawiki';
import axios from 'axios';

export default function CreatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    body: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.body.trim()) {
      setError('Body content is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine description and body for the page content
      const content = formData.description
        ? `${formData.description}\n\n${formData.body}`
        : formData.body;

      const result = await createPage(formData.title.trim(), content);

      if (result.success && result.pageId) {
        // Store page creator - use creator from result (set by server) or fallback to client-side check
        let creator = result.creator;
        
        if (!creator) {
          // Fallback: get creator from client-side
          try {
            const userResponse = await axios.get('/api/auth/user', {
              withCredentials: true,
            });
            if (userResponse.data.loggedIn && userResponse.data.user) {
              creator = userResponse.data.user.realname || userResponse.data.user.username;
            }
          } catch {
            // User not logged in - that's okay
          }
        }
        
        // Store page creator if we have one
        if (creator) {
          try {
            console.log('Storing page creator:', {
              pageId: result.pageId,
              pageTitle: formData.title.trim(),
              creator: creator,
            });
            const creatorResponse = await axios.post('/api/pages/creator', {
              pageId: result.pageId,
              pageTitle: formData.title.trim(),
              creator: creator,
            }, {
              withCredentials: true,
            });
            console.log('Creator stored successfully:', creatorResponse.data);
            
            // Verify it was stored
            const verifyResponse = await axios.get('/api/pages/creator', {
              params: { pageId: result.pageId },
            });
            console.log('Verified stored creator:', verifyResponse.data.creator);
          } catch (err: any) {
            console.error('Failed to store page creator:', err);
            console.error('Error details:', err.response?.data);
            // Non-critical error - continue anyway
          }
        } else {
          console.warn('No creator to store - user not logged in');
        }
        
        // Navigate to the new page
        const slug = encodeURIComponent(formData.title.trim().replace(/\s+/g, '_'));
        router.push(`/${slug}`);
      } else {
        setError(result.error || 'Failed to create page. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while creating the page.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="text-primary-600 hover:text-primary-700 mb-4 inline-block"
      >
        ← Back to Home
      </Link>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Create New Page
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Enter page title..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Short Description
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter a brief description..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="body"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="body"
              name="body"
              value={formData.body}
              onChange={handleChange}
              required
              rows={15}
              placeholder="Enter page content... (You can use MediaWiki markup)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              disabled={isSubmitting}
            />
            <p className="mt-2 text-sm text-gray-500">
              You can use MediaWiki markup syntax in the content.
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
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Page'}
            </button>
            <Link
              href="/"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}


