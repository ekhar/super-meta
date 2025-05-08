'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/lib/database.types'

type UserWithRole = Database['public']['Tables']['user_roles']['Row'] & {
  email: string
}

type UserMetrics = {
  user_id: string
  total_api_requests: number
  total_read_bytes: number
  total_write_bytes: number
  total_egress_bytes: number
  last_updated_at: string
}

type DatabaseRecord = Database['public']['Tables']['databases']['Row']

type DashboardStats = {
  totalUsers: number
  totalAdmins: number
  totalDatabases: number
  totalStorageUsed: number
  totalApiRequests: number
  totalReadVolume: number
  totalWriteVolume: number
  totalEgressVolume: number
  recentUsers: UserWithRole[]
  recentDatabases: DatabaseRecord[]
  recentMetrics: UserMetrics[]
}

export default function AdminDashboardRealtime() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalDatabases: 0,
    totalStorageUsed: 0,
    totalApiRequests: 0,
    totalReadVolume: 0,
    totalWriteVolume: 0,
    totalEgressVolume: 0,
    recentUsers: [],
    recentDatabases: [],
    recentMetrics: []
  })

  useEffect(() => {
    const supabase = createClient()

    // Initial data fetch
    async function fetchData() {
      try {
        const [
          { data: users },
          { data: databases },
          { data: metrics }
        ] = await Promise.all([
          supabase.from('user_roles').select('*').order('created_at', { ascending: false }),
          supabase.from('databases').select('*').order('created_at', { ascending: false }),
          supabase.from('user_metrics').select('*').order('total_api_requests', { ascending: false })
        ])

        if (users && databases && metrics) {
          updateStats(users as UserWithRole[], databases as DatabaseRecord[], metrics as UserMetrics[])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    // Update stats function
    function updateStats(users: UserWithRole[], databases: DatabaseRecord[], metrics: UserMetrics[]) {
      setStats({
        totalUsers: users.length,
        totalAdmins: users.filter(u => u.role === 'admin').length,
        totalDatabases: databases.length,
        totalStorageUsed: databases.reduce((acc, db) => acc + (db.storage_size_bytes || 0), 0),
        totalApiRequests: metrics.reduce((acc, m) => acc + m.total_api_requests, 0),
        totalReadVolume: metrics.reduce((acc, m) => acc + m.total_read_bytes, 0),
        totalWriteVolume: metrics.reduce((acc, m) => acc + m.total_write_bytes, 0),
        totalEgressVolume: metrics.reduce((acc, m) => acc + m.total_egress_bytes, 0),
        recentUsers: users.slice(0, 5),
        recentDatabases: databases.slice(0, 5),
        recentMetrics: metrics.slice(0, 5)
      })
    }

    // Fetch initial data
    fetchData()

    // Set up realtime subscriptions
    const channel = supabase.channel('admin-dashboard-changes')

    // Subscribe to all relevant tables
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles'
        },
        () => {
          console.log('User roles changed, fetching new data')
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'databases'
        },
        () => {
          console.log('Databases changed, fetching new data')
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_metrics'
        },
        () => {
          console.log('User metrics changed, fetching new data')
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_metrics_daily'
        },
        () => {
          console.log('Daily metrics changed, fetching new data')
          fetchData()
        }
      )

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connected to realtime updates')
      }
    })

    // Cleanup subscription
    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Users</h2>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Admin Users</h2>
          <p className="text-3xl font-bold">{stats.totalAdmins}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Databases</h2>
          <p className="text-3xl font-bold">{stats.totalDatabases}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Storage</h2>
          <p className="text-3xl font-bold">{(stats.totalStorageUsed / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total API Requests</h2>
          <p className="text-3xl font-bold">{stats.totalApiRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Read Volume</h2>
          <p className="text-3xl font-bold">{(stats.totalReadVolume / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Write Volume</h2>
          <p className="text-3xl font-bold">{(stats.totalWriteVolume / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Total Egress</h2>
          <p className="text-3xl font-bold">{(stats.totalEgressVolume / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-6">Recent Users</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">API Requests</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {stats.recentUsers.map((user) => {
                  const metrics = stats.recentMetrics.find(m => m.user_id === user.id) || {
                    total_api_requests: 0,
                    total_read_bytes: 0,
                    total_write_bytes: 0,
                    total_egress_bytes: 0
                  }
                  const totalVolume = metrics.total_read_bytes + metrics.total_write_bytes + metrics.total_egress_bytes
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {metrics.total_api_requests.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {(totalVolume / 1024 / 1024).toFixed(2)} MB
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-6">Recent Databases</h2>
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
                {stats.recentDatabases.map((db) => (
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 