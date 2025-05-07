import { createClient } from '@/utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    const clientResponse = await createClient(request)
    const { supabase, response } = clientResponse

    // Get session
    const { data: { session } } = await supabase.auth.getSession()

    // If accessing protected routes without a session, redirect to auth
    if (!session && (
      request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin')
    )) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }

    // If accessing admin routes, check for admin role
    if (session && request.nextUrl.pathname.startsWith('/admin')) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (roleData?.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return response
  } catch (error) {
    // If there's an error, redirect to auth page
    return NextResponse.redirect(new URL('/auth', request.url))
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}