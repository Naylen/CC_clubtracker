"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  UserPlus,
  Calendar,
  CreditCard,
  Mail,
  ClipboardList,
  ShieldCheck,
  Tag,
  ClipboardCheck,
  FileUp,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home },
  { href: "/admin/members", label: "Members", icon: UserPlus },
  { href: "/admin/households", label: "Households", icon: Users },
  {
    href: "/admin/membership-years",
    label: "Membership Years",
    icon: Calendar,
  },
  {
    href: "/admin/membership-tiers",
    label: "Membership Tiers",
    icon: Tag,
  },
  { href: "/admin/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/admin/import", label: "Import Members", icon: FileUp },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/broadcasts", label: "Broadcasts", icon: Mail },
  { href: "/admin/audit-log", label: "Audit Log", icon: ClipboardList },
  {
    href: "/admin/admin-management",
    label: "Admin Management",
    icon: ShieldCheck,
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navLinks = navItems.map((item) => {
    const Icon = item.icon;
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-green-100 text-green-800"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-gray-50 p-4 md:block">
        <nav className="space-y-1">{navLinks}</nav>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold text-green-800">
                Menu
              </span>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-4">{navLinks}</nav>
          </aside>
        </div>
      )}
    </>
  );
}
