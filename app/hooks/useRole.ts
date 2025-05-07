import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type UserRole = 'admin' | 'user' | null

export function useRole() {
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          setRole(null)
          setLoading(false)
          return
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        setRole(roleData?.role || null)
      } catch (error) {
        console.error('Error fetching role:', error)
        setRole(null)
      } finally {
        setLoading(false)
      }
    }

    fetchRole()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { role, loading, isAdmin: role === 'admin' }
} 