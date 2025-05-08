import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardRealtime from '@/components/dashboard/AdminDashboardRealtime'

export default async function AdminDashboardPage() {
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

  if (roleError || !roleData || roleData.role !== 'admin') {
    console.error('Access denied: User is not an admin')
    redirect('/dashboard/user')
  }

  return <AdminDashboardRealtime />
} 