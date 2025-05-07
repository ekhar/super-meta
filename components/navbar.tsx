import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "./ui/button";
import { ThemeSwitcher } from "./theme-switcher";
import { UserCircle2, Database, LayoutDashboard, LogOut } from "lucide-react";

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Database className="h-6 w-6 text-primary" />
              <span className="ml-2 text-lg font-semibold text-gradient">SuperMeta</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
            )}
          </div>

          {/* Right side - Auth & Theme */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2 text-sm hover:text-primary">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="gap-2 text-sm hover:text-primary">
                    <UserCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Profile</span>
                  </Button>
                </Link>
                <form action="/auth/signout" method="post">
                  <Button variant="ghost" size="sm" className="gap-2 text-sm hover:text-primary">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/user">
                  <Button variant="ghost" size="sm" className="text-sm hover:text-primary">
                    User Login
                  </Button>
                </Link>
                <Link href="/auth/admin">
                  <Button size="sm" className="text-sm gradient-brand hover:gradient-hover text-white">
                    Admin Login
                  </Button>
                </Link>
              </div>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
} 