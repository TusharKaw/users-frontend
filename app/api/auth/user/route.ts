import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    
    if (!sessionId) {
      return NextResponse.json({
        loggedIn: false,
        user: null,
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({
        loggedIn: false,
        user: null,
      });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({
        loggedIn: false,
        user: null,
      });
    }

    return NextResponse.json({
      loggedIn: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        realname: user.realname,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json({
      loggedIn: false,
      user: null,
    });
  }
}
