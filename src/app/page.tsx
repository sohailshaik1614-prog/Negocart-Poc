import Link from "next/link";
import { ShieldCheck, Cpu, Sliders, ArrowRight, Zap, Lock, ShoppingBag } from "lucide-react";

export default function SaaSOverviewPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-emerald-500 selection:text-white">
      {/* SaaS Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg">
              N
            </div>
            <span className="font-bold text-xl tracking-tight text-white">NegoZaar</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              B2B SaaS Platform
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Merchant Console
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-lg transition shadow-lg shadow-emerald-500/20"
            >
              Launch Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Deterministic Pricing Guardrail Engine
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            The AI Negotiation Layer for Existing E-Commerce Stores
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed">
            NegoZaar connects to your existing Shopify or e-commerce store to enable intelligent,
            margin-protected price negotiations with high-intent shoppers directly on your product pages.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base rounded-xl transition shadow-xl shadow-emerald-500/25"
            >
              <span>Open Merchant Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/widget-sandbox"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base rounded-xl border border-slate-700 transition"
            >
              <span>Test Widget Simulator</span>
            </Link>
          </div>
        </div>

        {/* Core Principles Grid */}
        <div className="mt-24 grid sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800 backdrop-blur">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white mb-2">Deterministic Pricing Guard</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              The AI never has unrestricted pricing authority. Hard mathematical floor limits and discount
              ceilings are strictly enforced server-side before anything reaches the shopper.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800 backdrop-blur">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white mb-2">Zero Floor Leakage</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your minimum acceptable price is never exposed to the shopper, prompt injections are neutralized,
              and internal margins remain 100% confidential.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800 backdrop-blur">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white mb-2">Non-Invasive Integration</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your store keeps full ownership of products, cart, and checkout. NegoZaar acts purely as the
              conversion optimization and negotiation intelligence layer.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
