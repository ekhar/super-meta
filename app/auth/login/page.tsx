import { LoginForm } from '@/components/login-form'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function LoginPage() {
  const cookieStore = await cookies()
  const supabase = await createClient()

  // Check if user is already logged in
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    // Check user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    // Redirect based on role
    if (roleData?.role === 'admin') {
      redirect('/dashboard/admin')
    } else {
      redirect('/dashboard')
    }
  }

  return (
    <div className="container relative flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          Super Meta
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              Your personal database management platform
            </p>
          </blockquote>
        </div>
      </div>
      <div className="p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}