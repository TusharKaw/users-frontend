import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

// GET /api/comments?pageId=123
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json(
        { error: 'pageId parameter is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    // Get all comments for the page
    const allComments = db
      .prepare('SELECT * FROM comments WHERE pageId = ? ORDER BY createdAt ASC')
      .all(parseInt(pageId)) as Array<{
        id: number;
        pageId: number;
        pageTitle: string;
        text: string;
        author: string;
        parentCommentId: number | null;
        createdAt: string;
        updatedAt: string;
      }>;

    // Build nested structure: separate top-level comments and replies
    const topLevelComments = allComments.filter(c => !c.parentCommentId);
    const repliesMap = new Map<number, Array<typeof allComments[0]>>();
    
    // Group replies by parent comment ID
    allComments.forEach(comment => {
      if (comment.parentCommentId) {
        if (!repliesMap.has(comment.parentCommentId)) {
          repliesMap.set(comment.parentCommentId, []);
        }
        repliesMap.get(comment.parentCommentId)!.push(comment);
      }
    });

    // Build nested structure
    const buildCommentTree = (comment: typeof allComments[0]) => {
      const replies = repliesMap.get(comment.id) || [];
      return {
        id: comment.id,
        pageId: comment.pageId,
        text: comment.text,
        author: comment.author,
        createdAt: comment.createdAt,
        timestamp: comment.createdAt,
        parentCommentId: comment.parentCommentId,
        replies: replies.map(buildCommentTree),
      };
    };

    const nestedComments = topLevelComments.map(buildCommentTree);

    return NextResponse.json({ comments: nestedComments });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments
export async function POST(request: NextRequest) {
  try {
    const { pageId, pageTitle, text, author, parentCommentId } = await request.json();

    console.log('Creating comment:', { pageId, parentCommentId, hasText: !!text, author });

    if (!pageId || !text) {
      return NextResponse.json(
        { error: 'pageId and text are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // If parentCommentId is provided, verify it exists and belongs to the same page
    if (parentCommentId) {
      console.log('Validating parent comment:', parentCommentId);
      const parentComment = db
        .prepare('SELECT id, pageId FROM comments WHERE id = ?')
        .get(parentCommentId) as { id: number; pageId: number } | undefined;
      
      if (!parentComment) {
        console.error('Parent comment not found:', parentCommentId);
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
      
      if (parentComment.pageId !== parseInt(pageId)) {
        console.error('Parent comment pageId mismatch:', parentComment.pageId, 'vs', pageId);
        return NextResponse.json(
          { error: 'Parent comment does not belong to this page' },
          { status: 400 }
        );
      }
    }

    console.log('Inserting comment into database...');
    const result = db
      .prepare(
        'INSERT INTO comments (pageId, pageTitle, text, author, parentCommentId) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        parseInt(pageId),
        pageTitle || `Page ${pageId}`,
        text.trim(),
        author || 'Anonymous',
        parentCommentId || null
      );

    console.log('Comment created with ID:', result.lastInsertRowid);

    // Fetch the newly created comment
    const comment = db
      .prepare('SELECT * FROM comments WHERE id = ?')
      .get(result.lastInsertRowid);

    return NextResponse.json({ 
      success: true, 
      comment 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create comment',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

