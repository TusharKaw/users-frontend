import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || process.env.MEDIAWIKI_API || 'http://localhost:8000/api.php';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!title) {
      return NextResponse.json(
        { error: 'Title parameter is required' },
        { status: 400 }
      );
    }

    const response = await axios.get(API_URL, {
      params: {
        action: 'query',
        prop: 'revisions',
        titles: title,
        rvprop: 'ids|timestamp|user|comment|size|content',
        rvslots: 'main',
        rvlimit: limit,
        format: 'json',
        origin: '*',
      },
    });

    if (response.data.error) {
      console.error('Error fetching revision history:', response.data.error);
      return NextResponse.json(
        { error: response.data.error.info || 'Failed to fetch revision history' },
        { status: 500 }
      );
    }

    const pages = response.data.query?.pages;
    if (!pages) {
      return NextResponse.json({ revisions: [] });
    }

    const pageData = Object.values(pages)[0] as any;
    if (!pageData || !pageData.revisions) {
      return NextResponse.json({ revisions: [] });
    }

    const revisions = pageData.revisions.map((rev: any) => ({
      revid: rev.revid,
      parentid: rev.parentid || 0,
      user: rev.user || 'Unknown',
      timestamp: rev.timestamp,
      comment: rev.comment || '',
      size: rev.size || 0,
      content: rev.slots?.main?.content || rev['*'] || '',
    }));

    return NextResponse.json({ revisions });
  } catch (error: any) {
    console.error('Error fetching revision history:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch revision history',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

