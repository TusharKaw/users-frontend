'use client';

import { useState } from 'react';
import { Comment, voteComment } from '@/lib/mediawiki';
import { addComment } from '@/lib/mediawiki';
import axios from 'axios';

interface CommentItemProps {
  comment: Comment;
  pageId: number;
  pageTitle?: string;
  currentUser: { username: string; realname?: string } | null;
  onReplySubmitted: () => void;
  onVoteSubmitted: () => void;
  depth?: number;
}

export default function CommentItem({ 
  comment, 
  pageId, 
  pageTitle, 
  currentUser, 
  onReplySubmitted,
  onVoteSubmitted,
  depth = 0 
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [localUpvotes, setLocalUpvotes] = useState(comment.upvotes || 0);
  const [localDownvotes, setLocalDownvotes] = useState(comment.downvotes || 0);
  const [localUserVote, setLocalUserVote] = useState<number | null>(comment.userVote !== undefined ? comment.userVote : null);
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

  const handleVote = async (vote: 1 | -1) => {
    if (!currentUser) {
      alert('Please log in to vote on comments');
      return;
    }

    if (isVoting) return;

    setIsVoting(true);
    
    try {
      const result = await voteComment(comment.id, vote);
      
      if (result.success) {
        setLocalUpvotes(result.upvotes || 0);
        setLocalDownvotes(result.downvotes || 0);
        setLocalUserVote(result.userVote || null);
        onVoteSubmitted();
      } else {
        console.error('Failed to vote:', result.error);
        alert(result.error || 'Failed to vote. Please try again.');
      }
    } catch (error: any) {
      console.error('Error voting:', error);
      alert(error.message || 'Failed to vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const replyCount = comment.replies?.length || 0;
  const hasReplies = replyCount > 0;
  const netVotes = localUpvotes - localDownvotes;

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
      <div className={`${depth > 0 ? 'border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="flex gap-4">
          {/* Voting buttons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleVote(1)}
              disabled={isVoting || !currentUser}
              className={`p-1 rounded transition-colors ${
                localUserVote === 1
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-100'
              } ${isVoting || !currentUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title="Upvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <span className={`text-sm font-medium ${
              netVotes > 0 ? 'text-green-600' : netVotes < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {netVotes !== 0 ? (netVotes > 0 ? '+' : '') + netVotes : '0'}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={isVoting || !currentUser}
              className={`p-1 rounded transition-colors ${
                localUserVote === -1
                  ? 'text-red-600 bg-red-50'
                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
              } ${isVoting || !currentUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title="Downvote"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="text-xs text-gray-500 text-center mt-1">
              <div>{localUpvotes}↑</div>
              <div>{localDownvotes}↓</div>
            </div>
          </div>

          {/* Comment content */}
          <div className="flex-1">
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
                    onVoteSubmitted={onVoteSubmitted}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

