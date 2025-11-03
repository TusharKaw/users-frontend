'use client';

import { useState } from 'react';
import { Comment } from '@/lib/mediawiki';
import { addComment } from '@/lib/mediawiki';
import axios from 'axios';

interface CommentItemProps {
  comment: Comment;
  pageId: number;
  pageTitle?: string;
  currentUser: { username: string; realname?: string } | null;
  onReplySubmitted: () => void;
  depth?: number;
}

export default function CommentItem({ 
  comment, 
  pageId, 
  pageTitle, 
  currentUser, 
  onReplySubmitted,
  depth = 0 
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const maxDepth = 5; // Limit nesting depth

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      const author = currentUser ? (currentUser.realname || currentUser.username) : 'Anonymous';
      const result = await addComment(pageId, replyText.trim(), pageTitle || `Page ${pageId}`, author, comment.id);
      
      if (result.success) {
        setReplyText('');
        setIsReplying(false);
        onReplySubmitted();
      } else {
        console.error('Failed to submit reply:', result.error);
        alert(result.error || 'Failed to submit reply. Please try again.');
      }
    } catch (error: any) {
      console.error('Error submitting reply:', error);
      alert(error.message || 'Failed to submit reply. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const replyCount = comment.replies?.length || 0;
  const hasReplies = replyCount > 0;

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
      <div className={`${depth > 0 ? 'border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="font-medium text-gray-900">
              {comment.author || 'Anonymous'}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(comment.timestamp)}
            </div>
          </div>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap mb-3">
          {comment.text}
        </p>
        
        <div className="flex items-center space-x-4 mb-3">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Reply
          </button>
          {hasReplies && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showReplies ? `Hide ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : `Show ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
        </div>

        {isReplying && (
          <form onSubmit={handleReplySubmit} className="mb-4 bg-gray-50 p-4 rounded-lg">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${comment.author}...`}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
              disabled={isSubmitting}
              autoFocus
            />
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                disabled={!replyText.trim() || isSubmitting}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Posting...' : 'Post Reply'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReplying(false);
                  setReplyText('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {hasReplies && showReplies && depth < maxDepth && (
          <div className="mt-4 space-y-4">
            {comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                pageId={pageId}
                pageTitle={pageTitle}
                currentUser={currentUser}
                onReplySubmitted={onReplySubmitted}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

