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
    const comments = db
      .prepare('SELECT * FROM comments WHERE pageId = ? ORDER BY createdAt DESC')
      .all(parseInt(pageId));

    return NextResponse.json({ comments });
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
    const { pageId, pageTitle, text, author } = await request.json();

    if (!pageId || !text) {
      return NextResponse.json(
        { error: 'pageId and text are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const result = db
      .prepare(
        'INSERT INTO comments (pageId, pageTitle, text, author) VALUES (?, ?, ?, ?)'
      )
      .run(
        parseInt(pageId),
        pageTitle || `Page ${pageId}`,
        text.trim(),
        author || 'Anonymous'
      );

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

