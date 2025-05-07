import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "./ui/button";
import { ThemeSwitcher } from "./theme-switcher";
import { UserCircle2, Database, LayoutDashboard } from "lucide-react";
import { LogoutButton } from "./logout-button";

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user role if logged in
  let isAdmin = false;
  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = roleData?.role === 'admin';
  }

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
              <Link 
                href={isAdmin ? "/admin/dashboard" : "/dashboard"} 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Right side - Auth & Theme */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href={isAdmin ? "/admin/dashboard" : "/dashboard"}>
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
                <LogoutButton 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 text-sm hover:text-primary"
                >
                  <span className="hidden sm:inline">Sign out</span>
                </LogoutButton>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth">
                  <Button variant="ghost" size="sm" className="text-sm hover:text-primary">
                    Sign in
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