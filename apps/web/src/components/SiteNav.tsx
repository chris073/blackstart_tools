"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; localOnly?: boolean };

const BASE_LINKS: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/blog", label: "BLOG" },
  { href: "/tools", label: "TOOLS [private]", localOnly: true },
  { href: "/products", label: "PRODUCTS" },
  { href: "/handbook", label: "HANDBOOK [private]", localOnly: true },
  { href: "/about", label: "ABOUT" },
  { href: "/login", label: "LOGIN" },
];

function linkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ showPrivateLocal }: { showPrivateLocal: boolean }) {
  const pathname = usePathname();
  const links = BASE_LINKS.filter((l) => !l.localOnly || showPrivateLocal);

  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-[11px] font-semibold tracking-[0.12em] sm:gap-2 sm:text-xs"
      aria-label="Primary"
    >
      {links.map(({ href, label }) => {
        const active = linkActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-2.5 py-1.5 transition sm:px-3 ${
              active
                ? "bg-bsl-panel text-bsl-text ring-1 ring-emerald-400/45 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                : "text-bsl-muted hover:bg-bsl-panel/60 hover:text-bsl-text"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
