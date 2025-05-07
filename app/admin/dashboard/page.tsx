import { createClient } from '@/utils/supabase/server'

type User = {
  id: string
  role: 'admin' | 'user'
  users: {
    email: string
    created_at: string
  } | null
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Fetch all users with their roles
  const { data: users } = await supabase
    .from('user_roles')
    .select(`
      id,
      role,
      users:auth.users (
        email,
        created_at
      )
    `)
    .order('created_at', { ascending: false }) as { data: User[] | null }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-4xl font-bold">Admin Dashboard</h1>
      
      <div className="rounded-lg border">
        <div className="p-6">
          <h2 className="text-2xl font-semibold">User Management</h2>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        
        <div className="border-t">
          <div className="p-6">
            <h3 className="mb-4 text-lg font-medium">Users</h3>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-medium">Email</th>
                    <th className="p-4 text-left font-medium">Role</th>
                    <th className="p-4 text-left font-medium">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-4">{user.users?.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.users?.created_at && new Date(user.users.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 