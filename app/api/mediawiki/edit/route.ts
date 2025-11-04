import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || process.env.MEDIAWIKI_API || 'http://localhost:8000/api.php';

export async function POST(request: NextRequest) {
  try {
    const { title, content, token, cookies } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Forward cookies from client request to MediaWiki API
    const cookieHeader = request.headers.get('cookie') || cookies || '';
    const headers: Record<string, string> = {};
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Get current user from Next.js session
    const { getCurrentUser } = await import('@/lib/auth');
    const sessionId = request.cookies.get('sessionId')?.value;
    const currentUser = await getCurrentUser(sessionId);
    
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
            error: 'Unable to edit pages. Please ensure MediaWiki allows API-based editing. All authentication is handled by this platform.',
            code: 'TOKEN_FETCH_FAILED',
            details: tokenResponse.data.error,
            username: currentUser ? (currentUser.realname || currentUser.username) : null
          },
          { status: 403 }
        );
      }
    }

    // Handle MediaWiki's invalid token response
    if (!editToken || editToken === '+\\' || editToken.length < 10) {
      console.error('Invalid token received from MediaWiki:', editToken);
      return NextResponse.json(
        { 
          error: 'Unable to edit pages. MediaWiki API requires proper configuration. All user authentication is handled by this platform - users do not need to log in to MediaWiki.',
          code: 'INVALID_TOKEN',
          username: currentUser ? (currentUser.realname || currentUser.username) : null
        },
        { status: 403 }
      );
    }

    // Edit page via edit API - token must be in POST body, not query params
    const formData = new URLSearchParams();
    formData.append('action', 'edit');
    formData.append('title', title);
    formData.append('text', content);
    formData.append('token', editToken);
    formData.append('format', 'json');

    const response = await axios.post(API_URL, formData.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Check for errors in response
    if (response.data.error) {
      console.error('MediaWiki edit error:', response.data.error);
      
      // Handle specific error codes
      if (response.data.error.code === 'protectedpage') {
        return NextResponse.json(
          { 
            error: 'This page is protected and cannot be edited.',
            code: response.data.error.code,
            details: response.data.error 
          },
          { status: 403 }
        );
      }
      
      if (response.data.error.code === 'permissiondenied') {
        return NextResponse.json(
          { 
            error: 'You do not have permission to edit this page.',
            code: response.data.error.code,
            details: response.data.error 
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { 
          error: response.data.error.info || 'Failed to edit page',
          code: response.data.error.code,
          details: response.data.error 
        },
        { status: 400 }
      );
    }

    // Check for warnings (MediaWiki sometimes returns warnings even on success)
    if (response.data.edit?.result === 'Success') {
      return NextResponse.json({ 
        success: true,
        result: response.data.edit,
      });
    }

    // Check if there are warnings but edit succeeded
    if (response.data.warnings) {
      console.warn('MediaWiki edit warnings:', response.data.warnings);
      // Still return success if the edit result is success
      if (response.data.edit?.result === 'Success') {
        return NextResponse.json({ 
          success: true,
          result: response.data.edit,
          warnings: response.data.warnings,
        });
      }
    }

    // If we get here, something unexpected happened
    console.error('Unexpected MediaWiki edit response:', response.data);
    return NextResponse.json(
      { 
        error: 'Unexpected response from MediaWiki',
        details: response.data 
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Error editing page:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to edit page',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

