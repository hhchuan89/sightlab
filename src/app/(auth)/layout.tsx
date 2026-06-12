import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Stripped card layout for /login and /signup (PLAN §6.1). No app shell, no
 * toggles — just the wordmark and a centered card.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-5 py-12">
      <Link href="/" aria-label="SightLab home">
        <Wordmark variant="A" />
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
