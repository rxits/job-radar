import "./globals.css";
export const metadata = { title: "job-radar" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="flex gap-4 border-b border-neutral-800 px-6 py-3 text-sm">
          <a href="/" className="font-semibold">job-radar</a>
          <a href="/" className="text-neutral-400 hover:text-neutral-100">Board</a>
          <a href="/analytics" className="text-neutral-400 hover:text-neutral-100">Analytics</a>
          <a href="/profile" className="text-neutral-400 hover:text-neutral-100">Profile</a>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
