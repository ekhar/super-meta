'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'

interface LogoutButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  variant?: 'default' | 'ghost'
  showIcon?: boolean
}

export function LogoutButton({ 
  variant = 'default',
  showIcon = true,
  children,
  ...props 
}: LogoutButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear any application state/cache if needed
      
      // Redirect to auth page
      router.push('/auth')
      router.refresh() // Refresh the page to clear any server-side state
    } catch (error) {
      console.error('Error signing out:', error)
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        'Signing out...'
      ) : (
        <>
          {showIcon && <LogOut className="mr-2 h-4 w-4" />}
          {children || 'Sign out'}
        </>
      )}
    </Button>
  )
}