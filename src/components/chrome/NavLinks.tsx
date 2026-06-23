"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The primary nav links, with quiet active-state wayfinding. The only client
 * island in the shared header: it reads usePathname() so the current section's
 * link is full-accent + aria-current, while the others are text-2 → accent on
 * hover. Labels arrive already-translated from the (server) layout, so this stays
 * a dumb presentational client component with no i18n coupling.
 *
 * Rendered TWICE by SiteHeader — once in the mobile scroll-rail, once in the
 * desktop inline row — each wrapped in a container that is `display:none` at the
 * opposite breakpoint, so only one copy is ever in the a11y tree.
 */
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`label-mono inline-flex min-h-11 items-center whitespace-nowrap transition-colors hover:text-accent sm:min-h-0 ${
              active ? "text-accent" : "text-text-2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
