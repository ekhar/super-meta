import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/database.types'

export default async function DashboardPage() {
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

  // Redirect based on role
  if (roleData.role === 'admin') {
    redirect('/dashboard/admin')
  } else {
    redirect('/dashboard/user')
  }
} 
