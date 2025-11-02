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

    // Handle MediaWiki's invalid token response
    // MediaWiki returns '+\\' when anonymous editing is disabled or token is invalid
    if (!editToken || editToken === '+\\' || editToken.length < 10) {
      console.error('Invalid token received from MediaWiki:', editToken);
      console.error('This usually means anonymous editing is disabled in MediaWiki');
      return NextResponse.json(
        { 
          error: 'MediaWiki does not allow anonymous editing. Please enable anonymous editing in MediaWiki LocalSettings.php or log in to MediaWiki first.',
          code: 'ANONYMOUS_EDITING_DISABLED',
          details: 'Add this to your LocalSettings.php: $wgGroupPermissions[\'*\'][\'edit\'] = true;'
        },
        { status: 403 }
      );
    }

    // Create page via edit API - token must be in POST body, not query params
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
      const errorMsg = response.data.error.info || 'Failed to create page';
      const errorCode = response.data.error.code;
      
      // Check for specific error codes
      if (errorCode === 'permissiondenied' || errorCode === 'readonly' || errorMsg.includes('permission')) {
        return NextResponse.json(
          { 
            error: 'You do not have permission to create pages. Please enable anonymous editing in MediaWiki or log in.',
            code: errorCode,
            details: 'Add to LocalSettings.php: $wgGroupPermissions[\'*\'][\'edit\'] = true; $wgGroupPermissions[\'*\'][\'createpage\'] = true;'
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { 
          error: errorMsg,
          code: errorCode,
          details: response.data.error
        },
        { status: 400 }
      );
    }

    // Check if edit was successful
    if (response.data.edit && response.data.edit.result === 'Success') {
      return NextResponse.json({ 
        success: true, 
        data: response.data,
        pageId: response.data.edit.pageid,
        newRevId: response.data.edit.newrevid,
        title: response.data.edit.title || response.data.edit.newtitle || title
      });
    }

    // Check for warnings (page might have been created but with warnings)
    if (response.data.edit && response.data.edit.warnings) {
      console.warn('MediaWiki edit warnings:', response.data.edit.warnings);
      // If it has a pageid, consider it successful
      if (response.data.edit.pageid) {
        return NextResponse.json({ 
          success: true, 
          data: response.data,
          pageId: response.data.edit.pageid,
          warnings: response.data.edit.warnings
        });
      }
    }

    // If we get here, something unexpected happened
    console.error('Unexpected response from MediaWiki:', JSON.stringify(response.data, null, 2));
    return NextResponse.json(
      { 
        error: 'Unexpected response from MediaWiki API. Check server logs for details.',
        data: response.data 
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Error creating page:', error);
    
    // Better error handling
    if (error.response) {
      console.error('Error response:', error.response.data);
      return NextResponse.json(
        { 
          error: error.response.data?.error?.info || error.message || 'Failed to create page',
          details: error.response.data
        },
        { status: error.response.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create page' },
      { status: 500 }
    );
  }
}

