import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/navbar";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "SuperMeta - Your Personal Supabase Platform",
  description: "Create and manage SQLite databases with the power of Supabase",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.className} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1 w-full">
              {children}
            </div>
            <footer className="w-full border-t border-border/40">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    Powered by{" "}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      className="text-gradient font-semibold hover:opacity-90"
                      rel="noreferrer"
                    >
                      Supabase
                    </a>
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
