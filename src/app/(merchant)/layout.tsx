"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  History,
  BarChart3,
  Settings,
  Plug,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Package },
    { href: "/negotiations", label: "Negotiations", icon: History },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/integrations", label: "Integrations", icon: Plug },
    { href: "/billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Merchant SaaS Topbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-base shadow-sm">
                N
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">NegoZaar</span>
                <span className="text-[11px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  SaaS Portal
                </span>
              </div>
            </Link>

            {/* Primary Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 pl-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === "/products" && pathname === "/rules") ||
                  (item.href === "/negotiations" && pathname === "/sessions") ||
                  (item.href === "/integrations" && pathname === "/stores");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-slate-800 text-white font-semibold shadow-sm text-emerald-400"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            <Link
              href="/widget-sandbox"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
              title="Test real AI negotiations in the interactive simulator"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sandbox</span>
            </Link>

            <div className="hidden sm:flex items-center pl-3 border-l border-slate-800 space-x-2.5">
              <div className="text-right">
                <div className="text-xs font-semibold text-white">Apex Luxury Lifestyle</div>
                <div className="text-[10px] text-slate-400 font-mono">apex-luxury.myshopify.com</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
                AL
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-slate-800 space-x-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/products" && pathname === "/rules") ||
              (item.href === "/negotiations" && pathname === "/sessions") ||
              (item.href === "/integrations" && pathname === "/stores");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition ${
                  isActive
                    ? "bg-slate-800 text-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Merchant Portal Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
