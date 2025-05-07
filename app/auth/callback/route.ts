import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      return NextResponse.redirect(`${origin}/auth/error?error=${error.message}`);
    }

    if (session) {
      // Check user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // Redirect based on role
        return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // If no code or session, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
