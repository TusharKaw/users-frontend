'use client';

import { useState } from 'react';
import { ratePage, getRating, Rating } from '@/lib/mediawiki';
import useSWR from 'swr';

interface RatingStarsProps {
  pageId: number;
}

export default function RatingStars({ pageId }: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: rating, mutate } = useSWR<Rating>(
    `rating-${pageId}`,
    () => getRating(pageId),
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  const handleRatingClick = async (ratingValue: number) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    const success = await ratePage(pageId, ratingValue);
    
    if (success) {
      // Revalidate rating data
      mutate();
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
          </div>
        )}
      </div>

      {isSubmitting && (
        <p className="text-sm text-gray-500">Submitting rating...</p>
      )}
    </div>
  );
}

