'use client';

import { useState, useEffect } from 'react';
import { ratePage, getRating, Rating } from '@/lib/mediawiki';
import useSWR from 'swr';
import axios from 'axios';
import Link from 'next/link';

interface RatingStarsProps {
  pageId: number;
  pageTitle?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  realname?: string;
}

export default function RatingStars({ pageId, pageTitle }: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
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

  // Get rating with current user's identity
  // Use user's username/realname as the author identifier
  const author = user ? (user.realname || user.username) : undefined;
  
  // Cache key should change when user changes to get fresh data
  const cacheKey = `rating-${pageId}-${user ? user.id : 'anonymous'}`;
  
  const { data: rating, mutate } = useSWR<Rating>(
    cacheKey,
    () => getRating(pageId, author),
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Refetch rating when user changes
  useEffect(() => {
    if (user || !user) {
      mutate();
    }
  }, [user?.id, mutate]);

  const handleRatingClick = async (ratingValue: number) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    // Pass the current user's username (or undefined for anonymous)
    const authorName = user ? (user.realname || user.username) : undefined;
    const result = await ratePage(pageId, ratingValue, pageTitle || `Page ${pageId}`, authorName);
    
    if (result.success) {
      // Force immediate revalidation of rating data
      mutate(undefined, { revalidate: true });
    } else {
      setError(result.error || 'Failed to submit rating. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  const displayRating = hoveredRating || (rating?.average || 0);
  const fullStars = Math.floor(displayRating);
  const hasHalfStar = displayRating % 1 >= 0.5;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Rate this article</h3>
      
      <div className="flex items-center space-x-2 mb-4">
        <div
          className="flex space-x-1"
          onMouseLeave={() => setHoveredRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingClick(star)}
              onMouseEnter={() => setHoveredRating(star)}
              disabled={isSubmitting}
              className={`text-3xl transition-all ${
                star <= fullStars
                  ? 'text-yellow-400'
                  : star === fullStars + 1 && hasHalfStar
                  ? 'text-yellow-200'
                  : 'text-gray-300'
              } hover:scale-110 ${
                isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
            >
              ★
            </button>
          ))}
        </div>
        
        {rating && (
          <div className="ml-4">
            <span className="text-lg font-medium text-gray-700">
              {rating.average.toFixed(1)}
            </span>
            <span className="text-sm text-gray-500 ml-1">
              ({rating.count} {rating.count === 1 ? 'rating' : 'ratings'})
            </span>
            {rating.userRating && (
              <span className="text-sm text-primary-600 ml-2 font-medium">
                (Your rating: {rating.userRating}★)
              </span>
            )}
          </div>
        )}
      </div>

      {user && !rating?.userRating && (
        <p className="text-sm text-gray-500 mb-2">
          Click a star to rate as {user.realname || user.username}
        </p>
      )}
      
      {!user && (
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/login" className="text-primary-600 hover:text-primary-700">Login</Link> to save your rating
        </p>
      )}

      {isSubmitting && (
        <p className="text-sm text-gray-500">Submitting rating...</p>
      )}
      
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

