import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || process.env.MEDIAWIKI_API || 'http://localhost:8000/api.php';

export async function POST(request: NextRequest) {
  try {
    const { pageId, text, token, cookies } = await request.json();

    if (!pageId || !text) {
      return NextResponse.json(
        { error: 'Page ID and text are required' },
        { status: 400 }
      );
    }

    // Forward cookies from client request to MediaWiki API
    const cookieHeader = request.headers.get('cookie') || cookies || '';
    const headers: Record<string, string> = {};
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Get edit token if not provided
    let editToken = token;
    if (!editToken) {
      const tokenResponse = await axios.get(API_URL, {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'csrf',
          format: 'json',
        },
        headers,
      });
      
      editToken = (tokenResponse.data as any).query?.tokens?.csrftoken || '';
      
      // Check if we got a proper token response
      if (tokenResponse.data.error) {
        console.error('Token fetch error:', tokenResponse.data.error);
        return NextResponse.json(
          { 
            error: tokenResponse.data.error.info || 'Failed to get edit token. You may need to log in to MediaWiki.',
            details: tokenResponse.data.error 
          },
          { status: 401 }
        );
      }
    }

    if (!editToken || editToken === '+\\') {
      return NextResponse.json(
        { error: 'Failed to get valid edit token. You may need to log in to MediaWiki.' },
        { status: 401 }
      );
    }

    // Add comment via Comments extension API - token must be in POST body
    // Comments extension uses 'commentsubmit' action with different parameter names
    const formData = new URLSearchParams();
    formData.append('action', 'commentsubmit');
    formData.append('pageID', pageId.toString()); // Note: pageID (capital ID), not pageid
    formData.append('commentText', text); // Note: commentText, not text
    formData.append('token', editToken);
    formData.append('format', 'json');
    // parentID is optional - only needed for replies; omit it for top-level comments

    const response = await axios.post(API_URL, formData.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Check for errors in response - handle both error object and error codes
    if (response.data.error) {
      const errorInfo = response.data.error.info || response.data.error.message || 'Failed to add comment';
      console.error('MediaWiki comment error:', {
        code: response.data.error.code,
        info: errorInfo,
        fullError: response.data.error,
        fullResponse: response.data
      });
      
      // Handle database errors specifically
      if (errorInfo.includes('database') || errorInfo.includes('Database') || response.data.error.code === 'internal_api_error_DBQueryError') {
        return NextResponse.json(
          { 
            error: 'Database error occurred. The Comments extension may need to be configured or the database tables may be missing.',
            code: response.data.error.code,
            details: errorInfo
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: errorInfo,
          code: response.data.error.code,
          details: response.data.error
        },
        { status: 400 }
      );
    }

    // Check if comment was successful
    // Comments extension returns success in different formats
    if (response.data.commentsubmit || 
        response.data.comment || 
        response.data.success !== false ||
        (response.data.result && response.data.result === 'Success')) {
      return NextResponse.json({ 
        success: true, 
        data: response.data
      });
    }

    // If we get here, something unexpected happened
    console.error('Unexpected response:', response.data);
    return NextResponse.json(
      { error: 'Unexpected response from MediaWiki API', data: response.data },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Error adding comment:', error);
    
    // Better error handling
    if (error.response) {
      console.error('Error response:', error.response.data);
      return NextResponse.json(
        { 
          error: error.response.data?.error?.info || error.message || 'Failed to add comment',
          details: error.response.data
        },
        { status: error.response.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to add comment' },
      { status: 500 }
    );
  }
}

