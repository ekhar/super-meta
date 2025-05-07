import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/database.types'
import CreateDatabaseButton from '@/components/CreateDatabaseButton'

export default async function UserDashboardPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  
  if (error || !data?.user) {
    redirect('/')
  }

  // Get user's role from the user_roles table
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (roleError || !roleData) {
    console.error('Error fetching user role:', roleError)
    redirect('/auth/login')
  }

  // If admin, redirect to admin dashboard
  if (roleData.role === 'admin') {
    redirect('/dashboard/admin')
  }

  // Get user's databases statistics
  const { data: dbStats, error: dbError } = await supabase
    .from('databases')
    .select(`
      id,
      name,
      storage_size_bytes,
      created_at
    `)
    .eq('owner_id', data.user.id)
    .order('created_at', { ascending: false })

  if (dbError) {
    console.error('Error fetching database stats:', dbError)
  }

  const totalDatabases = dbStats?.length || 0
  const totalStorageUsed = dbStats?.reduce((acc, db) => acc + (db.storage_size_bytes || 0), 0) || 0

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Dashboard</h1>
        <CreateDatabaseButton />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Databases</h2>
          <p className="text-3xl font-bold">{totalDatabases}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Storage Used</h2>
          <p className="text-3xl font-bold">{(totalStorageUsed / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">My Databases</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {dbStats?.map((db) => (
                <tr key={db.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{db.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {((db.storage_size_bytes || 0) / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(db.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!dbStats?.length && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-300">
                    No databases created yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 