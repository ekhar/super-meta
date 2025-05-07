'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface LoginFormProps extends React.ComponentPropsWithoutRef<'div'> {
  mode?: 'login' | 'signup'
}

export function LoginForm({ className, mode = 'login', ...props }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(mode === 'signup')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        // Sign up the user
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        if (!signUpData.user) throw new Error('No user data after sign up')

        if (isAdmin) {
          // For admin sign-ups, we need to check if there are existing admins
          const { data: adminCount } = await supabase
            .from('user_roles')
            .select('id')
            .eq('role', 'admin')

          if (adminCount && adminCount.length > 0) {
            throw new Error('Admin account already exists. Please contact support.')
          }

          // Set as first admin
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: 'admin' })
            .eq('id', signUpData.user.id)

          if (roleError) throw roleError
        }

        // No need to manually sign in - Supabase handles this
        router.push(isAdmin ? '/admin/dashboard' : '/dashboard')
      } else {
        // Login flow
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError

        // Get user data securely
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('No user found after login')

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (roleError) throw roleError

        // Check if user has the correct role type
        if (isAdmin && roleData?.role !== 'admin') {
          throw new Error('Access denied. Admin privileges required.')
        }

        // Redirect based on role
        router.push(roleData?.role === 'admin' ? '/admin/dashboard' : '/dashboard')
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const title = isSignUp ? 'Create Account' : 'Login'
  const description = isSignUp
    ? 'Enter your details below to create your account'
    : 'Enter your email below to login to your account'

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {isSignUp && (
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isAdmin"
                  checked={isAdmin}
                  onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                />
                <Label htmlFor="isAdmin">Admin Meta</Label>
              </div>
              {!isSignUp && (
                <Link
                  href="/auth/forgot-password"
                  className="text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (isSignUp ? 'Creating account...' : 'Logging in...') : title}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="underline underline-offset-4"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}