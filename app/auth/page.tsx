import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function AuthLanding() {
  return (
    <div className="container flex min-h-screen items-center justify-center">
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/50 to-purple-500/50 opacity-10" />
          <div className="relative p-6">
            <h2 className="mb-2 text-2xl font-bold">User Login</h2>
            <p className="mb-6 text-muted-foreground">
              Access your personal database management workspace
            </p>
            <div className="space-x-4">
              <Button asChild>
                <Link href="/auth/user">Login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/user/sign-up">Sign Up</Link>
              </Button>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/50 to-pink-500/50 opacity-10" />
          <div className="relative p-6">
            <h2 className="mb-2 text-2xl font-bold">Admin Login</h2>
            <p className="mb-6 text-muted-foreground">
              Manage the platform and user access
            </p>
            <div className="space-x-4">
              <Button asChild>
                <Link href="/auth/admin">Login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/admin/sign-up">Sign Up</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
} 