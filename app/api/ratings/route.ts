import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

// GET /api/ratings?pageId=123
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    let author = searchParams.get('author'); // Optional: to get user's rating

    // If no author provided, try to get current logged-in user
    if (!author) {
      const { getCurrentUser } = await import('@/lib/auth');
      const sessionId = request.cookies.get('sessionId')?.value;
      const currentUser = await getCurrentUser(sessionId);
      if (currentUser) {
        author = currentUser.realname || currentUser.username;
      }
    }

    if (!pageId) {
      return NextResponse.json(
        { error: 'pageId parameter is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Get all ratings for the page
    const ratings = db
      .prepare('SELECT rating FROM ratings WHERE pageId = ?')
      .all(parseInt(pageId)) as Array<{ rating: number }>;

    // Calculate average and count
    const count = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = count > 0 ? sum / count : 0;

    // Get user's rating if author is provided
    let userRating: number | undefined;
    if (author) {
      const userRatingRow = db
        .prepare('SELECT rating FROM ratings WHERE pageId = ? AND author = ?')
        .get(parseInt(pageId), author) as { rating: number } | undefined;
      userRating = userRatingRow?.rating;
    }

    return NextResponse.json({
      average: Math.round(average * 10) / 10, // Round to 1 decimal place
      count,
      userRating,
    });
  } catch (error: any) {
    console.error('Error fetching ratings:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch ratings',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/ratings
export async function POST(request: NextRequest) {
  try {
    const { pageId, pageTitle, rating, author: providedAuthor } = await request.json();

    if (!pageId || !rating) {
      return NextResponse.json(
        { error: 'pageId and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Get current user if author not provided
    let author = providedAuthor;
    if (!author) {
      const { getCurrentUser } = await import('@/lib/auth');
      const sessionId = request.cookies.get('sessionId')?.value;
      const currentUser = await getCurrentUser(sessionId);
      if (currentUser) {
        author = currentUser.realname || currentUser.username;
      } else {
        author = 'Anonymous';
      }
    }

    const db = getDatabase();
    
    // Check if rating already exists for this user (using the unique index)
    const existingRating = db
      .prepare('SELECT id FROM ratings WHERE pageId = ? AND author = ?')
      .get(parseInt(pageId), author) as { id: number } | undefined;

    if (existingRating) {
      // Update existing rating
      db.prepare(
        'UPDATE ratings SET rating = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(Math.round(rating), existingRating.id);
    } else {
      // Insert new rating - wrap in try-catch to handle unique constraint if index exists
      try {
        db.prepare(
          'INSERT INTO ratings (pageId, pageTitle, rating, author) VALUES (?, ?, ?, ?)'
        ).run(
          parseInt(pageId),
          pageTitle || `Page ${pageId}`,
          Math.round(rating),
          author
        );
      } catch (error: any) {
        // If unique constraint violation, update instead
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE')) {
          db.prepare(
            'UPDATE ratings SET rating = ?, updatedAt = CURRENT_TIMESTAMP WHERE pageId = ? AND author = ?'
          ).run(Math.round(rating), parseInt(pageId), author);
        } else {
          throw error;
        }
      }
    }

    // Fetch all ratings to calculate new average
    const ratings = db
      .prepare('SELECT rating FROM ratings WHERE pageId = ?')
      .all(parseInt(pageId)) as Array<{ rating: number }>;

    const count = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = count > 0 ? sum / count : 0;

    return NextResponse.json({
      success: true,
      average: Math.round(average * 10) / 10,
      count,
      userRating: Math.round(rating),
    });
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit rating' },
      { status: 500 }
    );
  }
}

