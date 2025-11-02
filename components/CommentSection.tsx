'use client';

import { useState, useEffect } from 'react';
import { getComments, addComment, Comment } from '@/lib/mediawiki';
import useSWR from 'swr';
import axios from 'axios';

interface CommentSectionProps {
  pageId: number;
  pageTitle?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  realname?: string;
}

export default function CommentSection({ pageId, pageTitle }: CommentSectionProps) {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [postAnonymous, setPostAnonymous] = useState(false);

  const { data: comments = [], mutate } = useSWR<Comment[]>(
    `comments-${pageId}`,
    () => getComments(pageId),
    {
      revalidateOnFocus: false,
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  );

  useEffect(() => {
    // Get current user info
    axios.get('/api/auth/user', {
      withCredentials: true,
    })
      .then((response) => {
        if (response.data.loggedIn && response.data.user) {
          setUser(response.data.user);
        }
      })
      .catch(() => {
        // User not logged in - that's okay
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    // Determine author: use username if logged in and not posting anonymous, otherwise Anonymous
    const author = (user && !postAnonymous) ? (user.realname || user.username) : 'Anonymous';
    
    const result = await addComment(pageId, commentText.trim(), pageTitle || `Page ${pageId}`, author);
    
    if (result.success) {
      setCommentText('');
      // Force immediate revalidation to show new comment
      mutate(undefined, { revalidate: true });
    } else {
      setError(result.error || 'Failed to submit comment. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h3>

      <form onSubmit={handleSubmit} className="mb-6">
        {user && (
          <div className="mb-3 text-sm text-gray-600">
            Posting as: <span className="font-medium text-gray-900">{user.realname || user.username}</span>
          </div>
        )}
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
          disabled={isSubmitting}
        />
        {user && (
          <div className="mb-3 flex items-center">
            <input
              type="checkbox"
              id="postAnonymous"
              checked={postAnonymous}
              onChange={(e) => setPostAnonymous(e.target.checked)}
              className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="postAnonymous" className="text-sm text-gray-700 cursor-pointer">
              Post as Anonymous
            </label>
          </div>
        )}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={!commentText.trim() || isSubmitting}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Post Comment'}
        </button>
      </form>

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-gray-900">
                  {comment.author || 'Anonymous'}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(comment.timestamp)}
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {comment.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

