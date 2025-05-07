import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/nav'
import type { Database } from '@/lib/database.types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Get user's role
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isAdmin = userRole?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardNav isAdmin={isAdmin} />
      <main>{children}</main>
    </div>
  )
} 