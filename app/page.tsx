import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ArrowRight, Database, Shield, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 w-full h-full dark:bg-grid-white/[0.05] bg-grid-black/[0.05]" />
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-background via-primary/5 to-background" />
        
        <div className="relative">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center mb-6">
            Your Personal{' '}
            <span className="text-gradient">Supabase Platform</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8 text-center">
            Create, manage, and scale your SQLite databases with the power of Supabase.
            Built on Supabase, for Supabase enthusiasts.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto gradient-brand hover:gradient-hover">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px] gradient-border">
                    User Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/auth" >
                  <Button size="lg" className="w-full sm:w-auto min-w-[200px] gradient-brand hover:gradient-hover">
                    Admin Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
          {!user && (
            <p className="mt-4 text-sm text-center text-muted-foreground">
              User login for database owners • Admin login for platform administrators
            </p>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 border-t border-border/40">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose <span className="text-gradient">SuperMeta</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50 border border-border/40">
              <Database className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Instant SQLite Databases</h3>
              <p className="text-muted-foreground">
                Create and manage SQLite databases with just a few clicks. Perfect for rapid prototyping and development.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50 border border-border/40">
              <Shield className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Secure by Default</h3>
              <p className="text-muted-foreground">
                Built on Supabase's security infrastructure with automatic backups and versioning.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50 border border-border/40">
              <Zap className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Edge Functions</h3>
              <p className="text-muted-foreground">
                Run your queries close to your users with Supabase Edge Functions and WASM-powered SQL execution.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
