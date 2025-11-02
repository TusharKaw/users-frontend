import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    
    if (sessionId) {
      await deleteSession(sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('sessionId');
    
    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    // Even if there's an error, clear the cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('sessionId');
    return response;
  }
}
