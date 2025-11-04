import { NextRequest, NextResponse } from 'next/server';
import { getArticle } from '@/lib/mediawiki';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const decodedSlug = decodeURIComponent(slug.replace(/_/g, ' '));
    
    const page = await getArticle(decodedSlug);
    
    if (!page || page.pageid === undefined) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      page: {
        pageid: page.pageid,
        title: page.title,
        content: page.content || '',
        extract: page.extract,
        thumbnail: page.thumbnail,
        original: page.original,
      },
    });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch article',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

