"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== "/dashboard" && path.startsWith(href));
  return (
    <Link href={href} className={`border-b-2 pb-0.5 transition ${active ? "border-nhs-blue font-medium text-nhs-blue" : "border-transparent text-slate-600 hover:text-nhs-blue"}`}>
      {children}
    </Link>
  );
}
