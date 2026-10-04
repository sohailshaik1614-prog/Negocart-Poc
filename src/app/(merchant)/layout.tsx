import Link from "next/link";
import {
  LayoutDashboard,
  Sliders,
  History,
  Store,
  Sparkles,
  ShieldAlert,
  ShoppingBag,
} from "lucide-react";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Merchant SaaS Topbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-base">
                N
              </div>
              <span className="font-bold text-lg tracking-tight">NegoZaar</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                Merchant Portal
              </span>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Overview
              </Link>
              <Link
                href="/rules"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <Sliders className="w-4 h-4" />
                Pricing Rules
              </Link>
              <Link
                href="/sessions"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <History className="w-4 h-4" />
                Live Sessions
              </Link>
              <Link
                href="/stores"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <Store className="w-4 h-4" />
                Stores & SDK
              </Link>
              <Link
                href="/widget-sandbox"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-emerald-400 hover:bg-slate-800 transition"
              >
                <Sparkles className="w-4 h-4" />
                Widget Sandbox
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">Apex Luxury Lifestyle</div>
              <div className="text-[11px] text-emerald-400 font-mono">apex-luxury.myshopify.com</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
              AL
            </div>
          </div>
        </div>
      </header>

      {/* Main Merchant Portal Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
