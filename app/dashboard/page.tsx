import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/database.types'

export default async function DashboardPage() {
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

  // Get relevant statistics
  const { data: dbStats } = await supabase
    .from('databases')
    .select('*', { count: 'exact' })
    .eq(isAdmin ? 'id' : 'owner_id', isAdmin ? 'id' : session.user.id)

  const totalDatabases = dbStats?.length || 0

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">
        {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Databases</h2>
          <p className="text-3xl font-bold">{totalDatabases}</p>
        </div>
        
        {isAdmin && (
          <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Total Users</h2>
              <p className="text-3xl font-bold">Coming soon</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Storage Used</h2>
              <p className="text-3xl font-bold">Coming soon</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">
          {isAdmin ? 'Recent Activity' : 'My Databases'}
        </h2>
        {/* Add table or list of databases here */}
      </div>
    </div>
  )
} 