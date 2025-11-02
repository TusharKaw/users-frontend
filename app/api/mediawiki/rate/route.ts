import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || process.env.MEDIAWIKI_API || 'http://localhost:8000/api.php';

export async function POST(request: NextRequest) {
  try {
    const { pageId, rating, token, cookies } = await request.json();

    if (!pageId || !rating) {
      return NextResponse.json(
        { error: 'Page ID and rating are required' },
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

    // Submit rating via VoteNY extension API - token must be in POST body
    // VoteNY extension uses 'voteny' action with different parameter names
    const formData = new URLSearchParams();
    formData.append('action', 'voteny');
    formData.append('what', 'vote'); // Action type
    formData.append('pageId', pageId.toString());
    formData.append('voteValue', rating.toString());
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
      const errorInfo = response.data.error.info || response.data.error.message || 'Failed to submit rating';
      console.error('MediaWiki rating error:', {
        code: response.data.error.code,
        info: errorInfo,
        fullError: response.data.error,
        fullResponse: response.data
      });
      return NextResponse.json(
        { 
          error: errorInfo,
          code: response.data.error.code,
          details: response.data.error
        },
        { status: 400 }
      );
    }
    
    // Log successful response for debugging
    console.log('VoteNY API response:', JSON.stringify(response.data, null, 2));

    // Check if rating was successful - VoteNY extension response structure
    // VoteNY returns voteny object with vote data or success indicators
    if (response.data.voteny || 
        response.data.success !== false ||
        (response.data.result && typeof response.data.result !== 'undefined') ||
        response.data.vote) {
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
    console.error('Error rating page:', error);
    
    // Better error handling
    if (error.response) {
      console.error('Error response:', error.response.data);
      return NextResponse.json(
        { 
          error: error.response.data?.error?.info || error.message || 'Failed to submit rating',
          details: error.response.data
        },
        { status: error.response.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to submit rating' },
      { status: 500 }
    );
  }
}

