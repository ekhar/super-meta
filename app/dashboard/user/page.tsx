'use client'

import { createClient } from '@/utils/supabase/client'
import { redirect } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Database } from '@/lib/database.types'
import CreateDatabaseButton from '@/components/CreateDatabaseButton'
import DeleteDatabaseButton from '@/components/DeleteDatabaseButton'

type DatabaseRow = Database['public']['Tables']['databases']['Row']

export default function UserDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [dbStats, setDbStats] = useState<DatabaseRow[] | null>(null)
  const supabase = createClient()

  const fetchDatabases = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      redirect('/')
      return
    }

    // Get user's role from the user_roles table
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !roleData) {
      console.error('Error fetching user role:', roleError)
      redirect('/auth/login')
      return
    }

    // If admin, redirect to admin dashboard
    if (roleData.role === 'admin') {
      redirect('/dashboard/admin')
      return
    }

    // Get user's databases statistics
    const { data: stats, error: dbError } = await supabase
      .from('databases')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Error fetching database stats:', dbError)
    }

    setDbStats(stats)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchDatabases()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {dbStats?.map((db) => (
                <tr key={db.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    <a 
                      href={`/dashboard/user/${db.name}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {db.name}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {((db.storage_size_bytes || 0) / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(db.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <DeleteDatabaseButton dbName={db.name} onDelete={fetchDatabases} />
                  </td>
                </tr>
              ))}
              {!dbStats?.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-300">
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