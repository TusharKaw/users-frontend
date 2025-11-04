'use client';

import { useState, useEffect } from 'react';
import { getPageInfo, setPageProtection } from '@/lib/mediawiki';
import axios from 'axios';

interface PageProtectionProps {
  pageTitle: string;
}

export default function PageProtection({ pageTitle }: PageProtectionProps) {
  const [pageInfo, setPageInfo] = useState<{
    protected: boolean;
    creator?: string;
  } | null>(null);
  const [dbCreator, setDbCreator] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string; realname?: string } | null>(null);

  useEffect(() => {
    // Get current user
    axios.get('/api/auth/user', {
      withCredentials: true,
    })
      .then((response) => {
        if (response.data.loggedIn && response.data.user) {
          setUser(response.data.user);
        }
      })
      .catch(() => {
        // User not logged in
      });
  }, []);

  useEffect(() => {
    // Load creator from local DB
    async function loadCreator() {
      try {
        const creatorResponse = await axios.get('/api/pages/creator', {
          params: { pageTitle },
        });
        setDbCreator(creatorResponse.data.creator);
      } catch (err) {
        console.warn('Could not load creator from local DB:', err);
        setDbCreator(null);
      }
    }
    
    if (pageTitle) {
      loadCreator();
    }
  }, [pageTitle]);

  useEffect(() => {
    async function loadPageInfo() {
      try {
        setIsLoading(true);
        setError(null);

        // Get page info from MediaWiki
        const info = await getPageInfo(pageTitle);
        if (!info) {
          setError('Failed to load page information');
          setIsLoading(false);
          return;
        }

        setPageInfo(info);

        // Check if current user is the creator (only creator can control protection)
        if (user) {
          // ALWAYS use local DB creator first - this is the source of truth
          // Only fallback to MediaWiki creator if DB has no record
          const creator = dbCreator || info.creator;
          
          const currentUserRealname = user.realname?.toLowerCase().trim();
          const currentUserUsername = user.username?.toLowerCase().trim();
          const creatorLower = creator?.toLowerCase().trim();
          
          console.log('Creator check:', {
            dbCreator: dbCreator || 'NOT FOUND IN DB',
            mwCreator: info.creator || 'NOT FOUND IN MW',
            usingCreator: creator || 'NONE',
            creatorLower,
            currentUserRealname,
            currentUserUsername,
            userRealname: user.realname,
            userUsername: user.username,
            matches: creatorLower && (
              creatorLower === currentUserRealname ||
              creatorLower === currentUserUsername
            )
          });
          
          // Only the original creator can control protection (case-insensitive comparison)
          // Prioritize DB creator over MediaWiki creator
          if (dbCreator) {
            // If we have DB creator, ONLY use that
            setIsCreator(
              dbCreator.toLowerCase().trim() === currentUserRealname ||
              dbCreator.toLowerCase().trim() === currentUserUsername
            );
          } else if (info.creator) {
            // Fallback to MediaWiki creator only if DB has no record
            setIsCreator(
              info.creator.toLowerCase().trim() === currentUserRealname ||
              info.creator.toLowerCase().trim() === currentUserUsername
            );
          } else {
            setIsCreator(false);
          }
        }
      } catch (err: any) {
        console.error('Error loading page info:', err);
        setError(err.message || 'Failed to load page information');
      } finally {
        setIsLoading(false);
      }
    }

    if (pageTitle && user) {
      loadPageInfo();
    }
  }, [pageTitle, user, dbCreator]);

  const handleToggleProtection = async () => {
    if (!pageInfo) return;

    setIsUpdating(true);
    setError(null);

    try {
      const newProtectionState = !pageInfo.protected;
      const result = await setPageProtection(pageTitle, newProtectionState);

      if (result.success) {
        setPageInfo({
          ...pageInfo,
          protected: newProtectionState,
        });
      } else {
        setError(result.error || 'Failed to update page protection');
      }
    } catch (err: any) {
      console.error('Error updating protection:', err);
      setError(err.message || 'Failed to update page protection');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Page Protection</h3>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!pageInfo) {
    return null;
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Page Protection</h3>
        <p className="text-gray-500 text-sm">
          Status: {pageInfo.protected ? '🔒 Protected' : '🔓 Unprotected'}
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Log in to manage page protection.
        </p>
      </div>
    );
  }

  if (!isCreator) {
    const displayCreator = dbCreator || pageInfo.creator;
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Page Protection</h3>
        <p className="text-gray-500 text-sm">
          Status: {pageInfo.protected ? '🔒 Protected' : '🔓 Unprotected'}
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Only the original page creator can manage protection settings.
        </p>
        {displayCreator && (
          <p className="text-gray-500 text-xs mt-1">
            Created by: {displayCreator}
          </p>
        )}
        {user && (
          <p className="text-gray-500 text-xs mt-1">
            You are: {user.realname || user.username}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Page Protection</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Status: <span className="font-medium">
                {pageInfo.protected ? '🔒 Protected' : '🔓 Unprotected'}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {pageInfo.protected 
                ? 'Only logged-in users can edit this page' 
                : 'Anyone can edit this page'}
            </p>
          </div>
          <button
            onClick={handleToggleProtection}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageInfo.protected
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isUpdating 
              ? 'Updating...' 
              : pageInfo.protected 
                ? 'Unprotect Page' 
                : 'Protect Page'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

