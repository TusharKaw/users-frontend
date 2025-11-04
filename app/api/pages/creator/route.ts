import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

// POST /api/pages/creator - Store page creator
export async function POST(request: NextRequest) {
  try {
    const { pageId, pageTitle, creator } = await request.json();

    if (!pageId || !pageTitle || !creator) {
      return NextResponse.json(
        { error: 'pageId, pageTitle, and creator are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Insert or update creator (using INSERT OR REPLACE)
    db.prepare(
      'INSERT OR REPLACE INTO page_creators (pageId, pageTitle, creator) VALUES (?, ?, ?)'
    ).run(parseInt(pageId), pageTitle, creator);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error storing page creator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to store page creator' },
      { status: 500 }
    );
  }
}

// GET /api/pages/creator?pageId=123 or ?pageTitle=Title
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const pageTitle = searchParams.get('pageTitle');

    if (!pageId && !pageTitle) {
      return NextResponse.json(
        { error: 'Either pageId or pageTitle is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    let creator;
    if (pageId) {
      creator = db
        .prepare('SELECT creator FROM page_creators WHERE pageId = ?')
        .get(parseInt(pageId)) as { creator: string } | undefined;
    } else {
      creator = db
        .prepare('SELECT creator FROM page_creators WHERE pageTitle = ?')
        .get(pageTitle) as { creator: string } | undefined;
    }

    return NextResponse.json({ 
      creator: creator?.creator || null 
    });
  } catch (error: any) {
    console.error('Error fetching page creator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch page creator' },
      { status: 500 }
    );
  }
}

