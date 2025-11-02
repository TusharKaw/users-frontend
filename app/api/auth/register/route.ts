import { NextRequest, NextResponse } from 'next/server';
import { createUser, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password, email, realname } = await request.json();

    if (!username || !password || !email) {
      return NextResponse.json(
        { error: 'Username, password, and email are required' },
        { status: 400 }
      );
    }

    // Validate username
    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    try {
      // Create user
      const user = await createUser(
        username.trim(),
        email.trim().toLowerCase(),
        password,
        realname?.trim()
      );

      // Create session (auto-login)
      const sessionId = await createSession(user.id);

      // Create response
      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          realname: user.realname,
        },
      });

      // Set session cookie
      response.cookies.set('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
