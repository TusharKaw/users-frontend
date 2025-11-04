# WikiReview

A Glassdoor-style website built with Next.js 14 that connects to a MediaWiki backend, allowing users to view articles, rate them, and leave comments.

## Features

- 🏠 **Home Page**: Browse trending articles with search functionality
- 📄 **Article Pages**: View full article content with ratings and comments
- ⭐ **Rating System**: Rate articles from 1-5 stars
- 💬 **Comments**: Add and view comments on articles
- ✏️ **Create Pages**: Create new articles via MediaWiki API

## Prerequisites

- Node.js 18+ and npm/yarn
- MediaWiki instance running at `http://localhost:8000/api.php`
- **Important:** MediaWiki must be configured to allow API-based editing. Add this to your MediaWiki `LocalSettings.php`:
  ```php
  // Allow anonymous editing via API (required for this platform)
  $wgGroupPermissions['*']['edit'] = true;
  $wgGroupPermissions['*']['createpage'] = true;
  
  // Allow API-based editing
  $wgEnableWriteAPI = true;
  ```
  
  **Note:** All user authentication is handled by this Next.js platform. Users do NOT need to log in to MediaWiki separately. MediaWiki is used purely as a backend content store.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Create `.env.local` file:**
   ```bash
   NEXT_PUBLIC_MEDIAWIKI_API=http://localhost:8000/api.php
   ```
   
   **Note:** If you cannot create `.env.local` directly, copy `.env.example` or create it manually with the content above.

3. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
wikireview/
├── app/
│   ├── page.tsx                # Home page
│   ├── [slug]/page.tsx         # Article view
│   ├── create/page.tsx         # Page creation
│   ├── layout.tsx              # Global layout
│   └── globals.css             # Global styles
├── components/
│   ├── RatingStars.tsx         # Rating component
│   ├── CommentSection.tsx      # Comments component
│   ├── PageCard.tsx            # Article card
│   └── Navbar.tsx              # Navigation bar
├── lib/
│   └── mediawiki.ts            # MediaWiki API wrapper
└── styles/
    └── globals.css             # (not used - see app/globals.css)
```

## MediaWiki API Integration

The project uses the following MediaWiki API endpoints:

- `action=query` - Fetch article content
- `action=edit` - Create new pages
- `action=comments` - Get/post comments (CommentStreams extension)
- `action=pagerating` - Get/submit ratings (PageRating/VoteNY extension)

## Configuration

### API Endpoint

Set your MediaWiki API endpoint in `.env.local`:
```
NEXT_PUBLIC_MEDIAWIKI_API=http://localhost:8000/api.php
```

### Adjusting API Calls

If your MediaWiki setup uses different extensions or API endpoints, modify the functions in `lib/mediawiki.ts`:

- `getComments()` - Adjust for your comments extension
- `addComment()` - Adjust for your comments extension
- `getRating()` - Adjust for your rating extension
- `ratePage()` - Adjust for your rating extension

## Building for Production

```bash
npm run build
npm start
```

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Axios** - HTTP client
- **SWR** - Data fetching and caching

## Notes

- All pages are server-side rendered (SSR) for SEO
- Comments and ratings use SWR for live updates
- The app gracefully handles missing MediaWiki extensions
- Error handling is included throughout the application

## Troubleshooting

### MediaWiki Connection Issues

If you're having trouble connecting to MediaWiki:

1. Verify your MediaWiki is running at `http://localhost:8000`
2. Check that CORS is enabled if accessing from different domain
3. Verify API endpoint is accessible: `http://localhost:8000/api.php?action=query&format=json`

### Comments/Ratings Not Working

If comments or ratings aren't working:

1. Verify your MediaWiki extensions are installed and enabled
2. Check extension API endpoints in `lib/mediawiki.ts`
3. Review MediaWiki extension documentation for correct API parameters

## License

MIT

