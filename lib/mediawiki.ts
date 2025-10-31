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
    const response = await axios.get<MediaWikiQueryResponse>(API_URL, {
      params: {
        action: 'query',
        prop: 'extracts|pageimages',
        titles: slug,
        format: 'json',
        explaintext: false,
        exintro: false,
        piprop: 'thumbnail|original',
        pithumbsize: 400,
        origin: '*',
      },
    });

    if (response.data.error) {
      console.error('MediaWiki API error:', response.data.error);
      return null;
    }

    const pages = response.data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.pageid === undefined) return null;

    return page;
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
        prop: 'extracts|pageimages',
        titles: titles,
        format: 'json',
        explaintext: true,
        exintro: true,
        exchars: 200,
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    return Object.values(pages).filter((p): p is MediaWikiPage => p.pageid !== undefined);
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
        prop: 'extracts|pageimages',
        titles: titles,
        format: 'json',
        explaintext: true,
        exintro: true,
        exchars: 200,
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    return Object.values(pages).filter((p): p is MediaWikiPage => p.pageid !== undefined);
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
        prop: 'extracts|pageimages',
        titles: titles,
        format: 'json',
        explaintext: true,
        exintro: true,
        exchars: 200,
        piprop: 'thumbnail',
        pithumbsize: 200,
        origin: '*',
      },
    });

    const pages = pagesResponse.data.query?.pages;
    if (!pages) return [];

    return Object.values(pages).filter((p): p is MediaWikiPage => p.pageid !== undefined);
  } catch (error) {
    console.error('Error searching pages:', error);
    return [];
  }
}

/**
 * Get comments for a page (using CommentStreams extension)
 */
export async function getComments(pageId: number): Promise<Comment[]> {
  try {
    // CommentStreams API endpoint (adjust based on your extension setup)
    const response = await axios.get(API_URL, {
      params: {
        action: 'comments',
        pageid: pageId,
        format: 'json',
        origin: '*',
      },
    });

    // Adjust response structure based on CommentStreams API format
    const comments = (response.data as any).query?.comments || (response.data as any).comments || [];
    return comments.map((c: any) => ({
      id: c.id || c.commentid || 0,
      pageId: pageId,
      text: c.text || c.comment || '',
      author: c.author || c.user || 'Anonymous',
      timestamp: c.timestamp || c.created || '',
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    // Return empty array if comments extension is not available
    return [];
  }
}

/**
 * Add a comment to a page
 */
export async function addComment(pageId: number, text: string, token?: string): Promise<boolean> {
  try {
    // First, get edit token if not provided
    let editToken = token;
    if (!editToken) {
      const tokenResponse = await axios.get(API_URL, {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'csrf',
          format: 'json',
          origin: '*',
        },
      });
      editToken = (tokenResponse.data as any).query?.tokens?.csrftoken || '';
    }

    // Add comment via CommentStreams API
    const response = await axios.post(API_URL, null, {
      params: {
        action: 'comment',
        pageid: pageId,
        text: text,
        token: editToken,
        format: 'json',
        origin: '*',
      },
    });

    return !response.data.error;
  } catch (error) {
    console.error('Error adding comment:', error);
    return false;
  }
}

/**
 * Get rating for a page (using PageRating/VoteNY extension)
 */
export async function getRating(pageId: number): Promise<Rating> {
  try {
    // Adjust endpoint based on your rating extension (VoteNY, PageRating, etc.)
    const response = await axios.get(API_URL, {
      params: {
        action: 'pagerating',
        pageid: pageId,
        format: 'json',
        origin: '*',
      },
    });

    // Adjust response structure based on your rating extension
    const data = response.data;
    if (data.error) {
      return { average: 0, count: 0 };
    }

    return {
      average: data.average || data.rating?.average || 0,
      count: data.count || data.rating?.count || 0,
      userRating: data.userRating || data.rating?.userRating,
    };
  } catch (error) {
    // Return default if rating extension is not available
    return { average: 0, count: 0 };
  }
}

/**
 * Rate a page (using PageRating/VoteNY extension)
 */
export async function ratePage(pageId: number, rating: number, token?: string): Promise<boolean> {
  try {
    // First, get edit token if not provided
    let editToken = token;
    if (!editToken) {
      const tokenResponse = await axios.get(API_URL, {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'csrf',
          format: 'json',
          origin: '*',
        },
      });
      editToken = (tokenResponse.data as any).query?.tokens?.csrftoken || '';
    }

    // Submit rating via rating extension API
    const response = await axios.post(API_URL, null, {
      params: {
        action: 'pagerating',
        pageid: pageId,
        rating: rating,
        token: editToken,
        format: 'json',
        origin: '*',
      },
    });

    return !response.data.error;
  } catch (error) {
    console.error('Error rating page:', error);
    return false;
  }
}

/**
 * Create a new page
 */
export async function createPage(title: string, content: string, token?: string): Promise<boolean> {
  try {
    // First, get edit token if not provided
    let editToken = token;
    if (!editToken) {
      const tokenResponse = await axios.get(API_URL, {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'csrf',
          format: 'json',
          origin: '*',
        },
      });
      editToken = (tokenResponse.data as any).query?.tokens?.csrftoken || '';
    }

    // Create page via edit API
    const response = await axios.post(API_URL, null, {
      params: {
        action: 'edit',
        title: title,
        text: content,
        token: editToken,
        format: 'json',
        origin: '*',
      },
    });

    return !response.data.error;
  } catch (error) {
    console.error('Error creating page:', error);
    return false;
  }
}

