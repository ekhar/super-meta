import { createClient } from '@/utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const { supabase, response } = await createClient(request)

    // Check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Check if the route requires admin access
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
    
    if (isAdminRoute) {
      // Query the user's role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (roleError || !roleData || roleData.role !== 'admin') {
        // Redirect non-admin users to the dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return response
  } catch (e) {
    // Return the error response
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/protected/:path*',
  ],
} 