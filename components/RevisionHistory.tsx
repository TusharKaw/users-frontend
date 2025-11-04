'use client';

import { useState, useEffect } from 'react';
import { getPageHistory, Revision } from '@/lib/mediawiki';
import axios from 'axios';

interface RevisionHistoryProps {
  pageTitle: string;
}

export default function RevisionHistory({ pageTitle }: RevisionHistoryProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const history = await getPageHistory(pageTitle, 50);
        setRevisions(history);
      } catch (err: any) {
        console.error('Error loading revision history:', err);
        setError(err.message || 'Failed to load revision history');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadHistory();
  }, [pageTitle]);

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Revision History</h3>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Revision History</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Revision History</h3>
        <p className="text-gray-500">No revisions found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">
        Revision History ({revisions.length} {revisions.length === 1 ? 'revision' : 'revisions'})
      </h3>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {revisions.map((revision, index) => (
          <div
            key={revision.revid}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedRevision === revision.revid
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedRevision(
              selectedRevision === revision.revid ? null : revision.revid
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="font-medium text-gray-900">
                    {revision.user || 'Unknown'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(revision.timestamp)}
                  </span>
                  {index === 0 && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Current
                    </span>
                  )}
                </div>
                {revision.comment && (
                  <p className="text-sm text-gray-600 italic mb-2">
                    "{revision.comment}"
                  </p>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Size: {formatSize(revision.size)}</span>
                  <span>Revision ID: {revision.revid}</span>
                </div>
                {selectedRevision === revision.revid && revision.content && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-xs">
                        {revision.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

