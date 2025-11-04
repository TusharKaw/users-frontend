import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || process.env.MEDIAWIKI_API || 'http://localhost:8000/api.php';

export async function POST(request: NextRequest) {
  try {
    const { title, protect, token } = await request.json();

    if (!title || protect === undefined) {
      return NextResponse.json(
        { error: 'Title and protect status are required' },
        { status: 400 }
      );
    }

    // Forward cookies from client request to MediaWiki API
    const cookieHeader = request.headers.get('cookie') || '';
    const headers: Record<string, string> = {};
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Get protect token if not provided
    let protectToken = token;
    if (!protectToken) {
      const tokenResponse = await axios.get(API_URL, {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'csrf',
          format: 'json',
        },
        headers,
      });
      
      protectToken = (tokenResponse.data as any).query?.tokens?.csrftoken || '';
      
      if (tokenResponse.data.error || !protectToken || protectToken === '+\\') {
        return NextResponse.json(
          { 
            error: 'Failed to get protection token. You may need to log in to MediaWiki.',
            details: tokenResponse.data.error 
          },
          { status: 401 }
        );
      }
    }

    // Prepare protection parameters
    const formData = new URLSearchParams();
    formData.append('action', 'protect');
    formData.append('title', title);
    formData.append('token', protectToken);
    formData.append('format', 'json');

    if (protect) {
      // Protect the page: edit=autoconfirmed means only logged-in users can edit
      formData.append('protections', 'edit=autoconfirmed');
      formData.append('reason', 'Page protection enabled by creator');
    } else {
      // Unprotect: allow all (empty protection)
      formData.append('protections', 'edit=');
      formData.append('reason', 'Page protection disabled by creator');
    }

    const response = await axios.post(API_URL, formData.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data.error) {
      console.error('MediaWiki protect error:', response.data.error);
      return NextResponse.json(
        { 
          error: response.data.error.info || 'Failed to set page protection',
          code: response.data.error.code,
          details: response.data.error 
        },
        { status: 400 }
      );
    }

    if (response.data.protect?.protections) {
      return NextResponse.json({ 
        success: true,
        result: response.data.protect,
      });
    }

    return NextResponse.json(
      { 
        error: 'Unexpected response from MediaWiki',
        details: response.data 
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Error setting page protection:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to set page protection',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

