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

    // Get current user from Next.js session for MediaWiki operations
    const { getCurrentUser } = await import('@/lib/auth');
    const sessionId = request.cookies.get('sessionId')?.value;
    const currentUser = await getCurrentUser(sessionId);
    
    // Get edit token if not provided
    let editToken = token;
    if (!editToken) {
      // Try to get token - this should work with anonymous editing enabled
      // OR with proper MediaWiki user authentication
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
        // If token fetch fails, it might be because anonymous editing is disabled
        // But since we're using local auth, we need to inform the user
        return NextResponse.json(
          { 
            error: 'Unable to edit pages. Please ensure MediaWiki allows API-based editing. All authentication is handled by this platform, not MediaWiki.',
            code: 'TOKEN_FETCH_FAILED',
            details: tokenResponse.data.error,
            suggestion: 'MediaWiki should allow editing via API. Check your MediaWiki LocalSettings.php configuration.'
          },
          { status: 403 }
        );
      }
    }

    // Handle MediaWiki's invalid token response
    // MediaWiki returns '+\\' when anonymous editing is disabled or token is invalid
    if (!editToken || editToken === '+\\' || editToken.length < 10) {
      console.error('Invalid token received from MediaWiki:', editToken);
      console.error('Current user:', currentUser?.username);
      return NextResponse.json(
        { 
          error: 'Unable to edit pages. MediaWiki API requires proper configuration. All user authentication is handled by this platform - users do not need to log in to MediaWiki separately.',
          code: 'INVALID_TOKEN',
          details: 'MediaWiki needs to allow API-based editing. This platform handles all authentication internally.',
          username: currentUser ? (currentUser.realname || currentUser.username) : 'Anonymous'
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
      const pageId = response.data.edit.pageid;
      const createdTitle = response.data.edit.title || response.data.edit.newtitle || title;
      
      // Default: Protect the page after creation
      try {
        // Get protect token
        const protectTokenResponse = await axios.get(API_URL, {
          params: {
            action: 'query',
            meta: 'tokens',
            type: 'csrf',
            format: 'json',
          },
          headers,
        });
        
        const protectToken = (protectTokenResponse.data as any).query?.tokens?.csrftoken || '';
        
        if (protectToken && protectToken !== '+\\') {
          // Protect the page by default (only logged-in users can edit)
          const protectFormData = new URLSearchParams();
          protectFormData.append('action', 'protect');
          protectFormData.append('title', createdTitle);
          protectFormData.append('token', protectToken);
          protectFormData.append('protections', 'edit=autoconfirmed');
          protectFormData.append('reason', 'Page protected by default');
          protectFormData.append('format', 'json');

          await axios.post(API_URL, protectFormData.toString(), {
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
          
          console.log('Page protected by default:', createdTitle);
        }
      } catch (protectError) {
        console.warn('Failed to protect page by default (non-critical):', protectError);
        // Continue anyway - page was created successfully
      }
      
      // Return response with creator info if available
      const { getCurrentUser } = await import('@/lib/auth');
      const sessionId = request.cookies.get('sessionId')?.value;
      const currentUser = await getCurrentUser(sessionId);
      const creator = currentUser ? (currentUser.realname || currentUser.username) : null;
      
      return NextResponse.json({ 
        success: true, 
        data: response.data,
        pageId: pageId,
        newRevId: response.data.edit.newrevid,
        title: createdTitle,
        creator: creator, // Include creator in response
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

