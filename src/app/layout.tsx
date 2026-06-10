import Link from "next/link";
import "./globals.css";
export const metadata = { title: "job-radar" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="flex gap-4 border-b border-neutral-800 px-6 py-3 text-sm">
          <Link href="/" className="font-semibold">job-radar</Link>
          <Link href="/" className="text-neutral-400 hover:text-neutral-100">Board</Link>
          <Link href="/analytics" className="text-neutral-400 hover:text-neutral-100">Analytics</Link>
          <Link href="/profile" className="text-neutral-400 hover:text-neutral-100">Profile</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
