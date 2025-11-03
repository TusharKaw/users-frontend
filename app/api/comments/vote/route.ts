import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/comments/vote
export async function POST(request: NextRequest) {
  try {
    const { commentId, vote } = await request.json();

    if (!commentId || vote === undefined) {
      return NextResponse.json(
        { error: 'commentId and vote are required' },
        { status: 400 }
      );
    }

    if (vote !== 1 && vote !== -1) {
      return NextResponse.json(
        { error: 'Vote must be 1 (upvote) or -1 (downvote)' },
        { status: 400 }
      );
    }

    // Get current user
    const sessionId = request.cookies.get('sessionId')?.value;
    const currentUser = await getCurrentUser(sessionId);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'You must be logged in to vote' },
        { status: 401 }
      );
    }

    const author = currentUser.realname || currentUser.username;
    const db = getDatabase();

    // Verify comment exists
    const comment = db
      .prepare('SELECT id FROM comments WHERE id = ?')
      .get(commentId) as { id: number } | undefined;

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user has already voted
    const existingVote = db
      .prepare('SELECT id, vote FROM comment_votes WHERE commentId = ? AND author = ?')
      .get(commentId, author) as { id: number; vote: number } | undefined;

    if (existingVote) {
      if (existingVote.vote === vote) {
        // User is trying to vote the same way again - remove the vote
        db.prepare('DELETE FROM comment_votes WHERE id = ?').run(existingVote.id);
      } else {
        // User is changing their vote
        db.prepare('UPDATE comment_votes SET vote = ? WHERE id = ?').run(vote, existingVote.id);
      }
    } else {
      // New vote
      db.prepare(
        'INSERT INTO comment_votes (commentId, author, vote) VALUES (?, ?, ?)'
      ).run(commentId, author, vote);
    }

    // Calculate new vote counts
    const upvotes = db
      .prepare('SELECT COUNT(*) as count FROM comment_votes WHERE commentId = ? AND vote = 1')
      .get(commentId) as { count: number };
    
    const downvotes = db
      .prepare('SELECT COUNT(*) as count FROM comment_votes WHERE commentId = ? AND vote = -1')
      .get(commentId) as { count: number };

    // Get user's current vote
    const userVote = db
      .prepare('SELECT vote FROM comment_votes WHERE commentId = ? AND author = ?')
      .get(commentId, author) as { vote: number } | undefined;

    return NextResponse.json({
      success: true,
      upvotes: upvotes.count,
      downvotes: downvotes.count,
      userVote: userVote?.vote || null,
    });
  } catch (error: any) {
    console.error('Error voting on comment:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to vote on comment',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

