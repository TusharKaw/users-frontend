'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

interface EditButtonProps {
  pageTitle: string;
}

export default function EditButton({ pageTitle }: EditButtonProps) {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; realname?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    axios.get('/api/auth/user', {
      withCredentials: true,
    })
      .then((response) => {
        if (response.data.loggedIn && response.data.user) {
          setUser(response.data.user);
        }
      })
      .catch(() => {
        // User not logged in - that's okay
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null; // Don't show edit button if not logged in
  }

  const editUrl = `/edit/${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}`;

  return (
    <Link
      href={editUrl}
      className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      <span>Edit</span>
    </Link>
  );
}

