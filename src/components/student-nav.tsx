"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, ListChecks, UserRound } from "lucide-react";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/qbank", label: "QBank", icon: ListChecks },
  { href: "/my-learning", label: "My Learning", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="nav-links" aria-label="Main">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="nav-link"
          aria-current={isActive(pathname, href) ? "page" : undefined}
        >
          <Icon size={18} aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="nav-link"
          aria-current={isActive(pathname, href) ? "page" : undefined}
        >
          <Icon size={22} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}