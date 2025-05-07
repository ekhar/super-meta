import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function promoteToAdmin(userId: string) {
  const supabase = await createClient()
  
  // Check if the current user is an admin
  const { data: currentUserRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!currentUserRole || currentUserRole.role !== 'admin') {
    throw new Error('Only admins can promote users to admin role')
  }

  // Update the user's role to admin
  const { error } = await supabase
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to promote user to admin: ${error.message}`)
  }

  return { success: true }
}

export async function setFirstAdmin(userId: string) {
  const supabase = await createClient()
  
  // Check if there are any admins
  const { data: adminCount } = await supabase
    .from('user_roles')
    .select('id')
    .eq('role', 'admin')
  
  // Only allow setting first admin if there are no admins yet
  if (adminCount && adminCount.length > 0) {
    throw new Error('Cannot set first admin: admins already exist')
  }

  // Update the user's role to admin
  const { error } = await supabase
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to set first admin: ${error.message}`)
  }

  return { success: true }
} 