import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_API || 'http://localhost:8000/api.php';

export interface MediaWikiPage {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

export interface MediaWikiQueryResponse {
  query?: {
    pages?: Record<string, MediaWikiPage>;
  };
  error?: {
    code: string;
    info: string;
  };
}

export interface Comment {
  id: number;
  pageId: number;
  text: string;
  author: string;
  timestamp: string;
  parentCommentId?: number | null;
  replies?: Comment[];
  upvotes?: number;
  downvotes?: number;
  userVote?: number | null; // 1 for upvote, -1 for downvote, null for no vote
}

export interface Rating {
  average: number;
  count: number;
  userRating?: number;
}

/**
 * Fetch article content from MediaWiki
 */
export async function getArticle(slug: string): Promise<MediaWikiPage | null> {
  try {
    // First, get page info and images
    const pageResponse = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        prop: 'pageimages|revisions',
        titles: slug,
        format: 'json',
        piprop: 'thumbnail|original',
        pithumbsize: 400,
        rvprop: 'content',
        rvslots: 'main',
        origin: '*',
      },
    });

    if (pageResponse.data.error) {
      console.error('MediaWiki API error:', pageResponse.data.error);
      return null;
    }

    const pages = pageResponse.data.query?.pages;
    if (!pages) return null;

    const pageData = Object.values(pages)[0] as any;
    if (!pageData || pageData.pageid === undefined) return null;

    // Get parsed HTML content using parse action
    let extract = '';
    try {
      const parseResponse = await axios.get(API_URL, {
        params: {
          action: 'parse',
          page: slug,
          format: 'json',
          prop: 'text',
          disablelimitreport: true,
          origin: '*',
        },
      });

      if (parseResponse.data?.parse?.text?.['*']) {
        extract = parseResponse.data.parse.text['*'];
      }
    } catch (parseError) {
      console.warn('Failed to get parsed content, trying revisions:', parseError);
      // Fallback: use raw wikitext from revisions if parse fails
      const revisions = pageData.revisions;
      if (revisions && revisions[0]?.slots?.main?.content) {
        extract = revisions[0].slots.main.content;
      }
    }

    return {
      pageid: pageData.pageid,
      title: pageData.title,
      extract: extract || undefined,
      thumbnail: pageData.thumbnail ? {
        source: pageData.thumbnail.source,
        width: pageData.thumbnail.width || 0,
        height: pageData.thumbnail.height || 0,
      } : undefined,
      original: pageData.original ? {
        source: pageData.original.source,
        width: pageData.original.width || 0,
        height: pageData.original.height || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

/**
 * Get top-rated pages (via categorymembers or templates)
 */
export async function getTopPages(limit: number = 10): Promise<MediaWikiPage[]> {
  try {
    // Try to fetch pages from a category, or fallback to recent pages
    const response = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Top Rated', // Adjust based on your MediaWiki setup
        cmlimit: limit,
        cmprop: 'title|ids',
        format: 'json',
        origin: '*',
      },
    });

    if (response.data.error) {
      // Fallback to recent pages if category doesn't exist
      return await getRecentPages(limit);
    }

    const members = (response.data as any).query?.categorymembers || [];
    if (members.length === 0) {
      return await getRecentPages(limit);
    }

    const titles = members.map((m: any) => m.title).join('|');
    const pagesResponse = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        prop: 'pageimages',
        titles: titles,
        format: 'json',
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    // Map pages and add basic extract (just title for now, can be enhanced later)
    return Object.values(pages)
      .filter((p: any): p is MediaWikiPage => p.pageid !== undefined)
      .map((p: any) => ({
        pageid: p.pageid,
        title: p.title,
        extract: '', // Empty for list view
        thumbnail: p.thumbnail ? {
          source: p.thumbnail.source,
          width: p.thumbnail.width || 0,
          height: p.thumbnail.height || 0,
        } : undefined,
      }));
  } catch (error) {
    console.error('Error fetching top pages:', error);
    return await getRecentPages(limit);
  }
}

/**
 * Get recent pages as fallback
 */
async function getRecentPages(limit: number): Promise<MediaWikiPage[]> {
  try {
    const response = await axios.get(API_URL, {
      params: {
        action: 'query',
        list: 'recentchanges',
        rclimit: limit,
        rcprop: 'title',
        format: 'json',
        origin: '*',
      },
    });

    const changes = (response.data as any).query?.recentchanges || [];
    if (changes.length === 0) return [];

    const titles = changes.map((c: any) => c.title).join('|');
    const pagesResponse = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        prop: 'pageimages',
        titles: titles,
        format: 'json',
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    // Map pages and add basic extract (empty for list view)
    return Object.values(pages)
      .filter((p: any): p is MediaWikiPage => p.pageid !== undefined)
      .map((p: any) => ({
        pageid: p.pageid,
        title: p.title,
        extract: '', // Empty for list view
        thumbnail: p.thumbnail ? {
          source: p.thumbnail.source,
          width: p.thumbnail.width || 0,
          height: p.thumbnail.height || 0,
        } : undefined,
      }));
  } catch (error) {
    console.error('Error fetching recent pages:', error);
    return [];
  }
}

/**
 * Search for pages
 */
export async function searchPages(query: string, limit: number = 10): Promise<MediaWikiPage[]> {
  try {
    const response = await axios.get(API_URL, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        format: 'json',
        origin: '*',
      },
    });

    const results = (response.data as any).query?.search || [];
    if (results.length === 0) return [];

    const titles = results.map((r: any) => r.title).join('|');
    const pagesResponse = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        prop: 'pageimages',
        titles: titles,
        format: 'json',
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    // Map pages and add basic extract (empty for list view)
    return Object.values(pages)
      .filter((p: any): p is MediaWikiPage => p.pageid !== undefined)
      .map((p: any) => ({
        pageid: p.pageid,
        title: p.title,
        extract: '', // Empty for list view
        thumbnail: p.thumbnail ? {
          source: p.thumbnail.source,
          width: p.thumbnail.width || 0,
          height: p.thumbnail.height || 0,
        } : undefined,
      }));
  } catch (error) {
    console.error('Error searching pages:', error);
    return [];
  }
}

/**
 * Get comments for a page (stored in local database)
 */
export async function getComments(pageId: number): Promise<Comment[]> {
  try {
    // Call local API route
    const response = await axios.get('/api/comments', {
      params: {
        pageId: pageId,
      },
    });

    if (response.data.error) {
      console.error('Comments API error:', response.data.error);
      return [];
    }

    // Map database comments to Comment interface (nested structure)
    const comments = response.data.comments || [];
    return comments.map((c: any): Comment => ({
      id: c.id || 0,
      pageId: c.pageId || pageId,
      text: c.text || '',
      author: c.author || 'Anonymous',
      timestamp: c.createdAt || c.timestamp || new Date().toISOString(),
      parentCommentId: c.parentCommentId || null,
      upvotes: c.upvotes || 0,
      downvotes: c.downvotes || 0,
      userVote: c.userVote !== undefined ? c.userVote : null,
      replies: c.replies ? c.replies.map((r: any): Comment => ({
        id: r.id || 0,
        pageId: r.pageId || pageId,
        text: r.text || '',
        author: r.author || 'Anonymous',
        timestamp: r.createdAt || r.timestamp || new Date().toISOString(),
        parentCommentId: r.parentCommentId || null,
        upvotes: r.upvotes || 0,
        downvotes: r.downvotes || 0,
        userVote: r.userVote !== undefined ? r.userVote : null,
        replies: r.replies || [],
      })) : [],
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

/**
 * Add a comment to a page (stored in local database)
 */
export async function addComment(pageId: number, text: string, pageTitle?: string, author?: string, parentCommentId?: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Call local API route
    const response = await axios.post('/api/comments', {
      pageId,
      pageTitle: pageTitle || `Page ${pageId}`,
      text,
      author: author || 'Anonymous',
      parentCommentId: parentCommentId || null,
    });

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string' 
        ? response.data.error 
        : response.data.error || 'Failed to add comment';
      console.error('Error adding comment:', errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: response.data.success === true };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Failed to add comment';
    console.error('Error adding comment:', errorMsg, error.response?.data);
    return { 
      success: false, 
      error: typeof errorMsg === 'string' ? errorMsg : 'Failed to add comment'
    };
  }
}

/**
 * Vote on a comment (upvote or downvote)
 */
export async function voteComment(commentId: number, vote: 1 | -1): Promise<{ 
  success: boolean; 
  upvotes?: number; 
  downvotes?: number; 
  userVote?: number | null;
  error?: string 
}> {
  try {
    const response = await axios.post('/api/comments/vote', {
      commentId,
      vote,
    }, {
      withCredentials: true,
    });

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string' 
        ? response.data.error 
        : response.data.error || 'Failed to vote on comment';
      console.error('Error voting on comment:', errorMsg);
      return { success: false, error: errorMsg };
    }

    return { 
      success: true,
      upvotes: response.data.upvotes || 0,
      downvotes: response.data.downvotes || 0,
      userVote: response.data.userVote || null,
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Failed to vote on comment';
    console.error('Error voting on comment:', errorMsg, error.response?.data);
    return { 
      success: false, 
      error: typeof errorMsg === 'string' ? errorMsg : 'Failed to vote on comment'
    };
  }
}

/**
 * Get rating for a page (stored in local database)
 */
export async function getRating(pageId: number, author?: string): Promise<Rating> {
  try {
    // Call local API route
    const response = await axios.get('/api/ratings', {
      params: {
        pageId: pageId,
        ...(author && { author }),
      },
    });

    if (response.data.error) {
      console.error('Ratings API error:', response.data.error);
      return { average: 0, count: 0 };
    }

    return {
      average: response.data.average || 0,
      count: response.data.count || 0,
      userRating: response.data.userRating,
    };
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return { average: 0, count: 0 };
  }
}

/**
 * Rate a page (stored in local database)
 */
export async function ratePage(pageId: number, rating: number, pageTitle?: string, author?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Call local API route
    const response = await axios.post('/api/ratings', {
      pageId,
      pageTitle: pageTitle || `Page ${pageId}`,
      rating,
      author: author || 'Anonymous',
    });

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string' 
        ? response.data.error 
        : response.data.error || 'Failed to submit rating';
      console.error('Error rating page:', errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: response.data.success === true };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Failed to submit rating';
    console.error('Error rating page:', errorMsg, error.response?.data);
    return { 
      success: false, 
      error: typeof errorMsg === 'string' ? errorMsg : 'Failed to submit rating'
    };
  }
}

/**
 * Create a new page
 */
export async function createPage(title: string, content: string, token?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Call Next.js API route which handles MediaWiki API call server-side
    const response = await axios.post('/api/mediawiki/create', {
      title,
      content,
      token,
    });

    if (response.data.error) {
      const errorMsg = typeof response.data.error === 'string' 
        ? response.data.error 
        : response.data.error?.info || 'Failed to create page';
      console.error('Error creating page:', errorMsg, response.data.details);
      return { success: false, error: errorMsg };
    }

    return { success: response.data.success === true };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Failed to create page';
    console.error('Error creating page:', errorMsg, error.response?.data?.details);
    return { 
      success: false, 
      error: typeof errorMsg === 'string' ? errorMsg : errorMsg?.info || 'Failed to create page'
    };
  }
}

