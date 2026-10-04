import Link from "next/link";
import {
  TrendingUp,
  Percent,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Sliders,
  Sparkles,
  ShoppingBag,
} from "lucide-react";

export default function MerchantDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Merchant Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Performance metrics and deterministic price protection summary for Apex Luxury Lifestyle.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Negotiations
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">124</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> +18.4% from last week
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Deal Conversion Rate
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">62.8%</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> +4.2% uplift vs static discounts
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Conceded Discount
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">14.6%</div>
            <p className="text-xs text-slate-500 mt-1">
              Well below merchant 25% max limit
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Guardrail Protected Margin
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">₹48,200</div>
            <p className="text-xs text-purple-600 font-medium mt-1">
              100% floor price adherence enforced
            </p>
          </div>
        </div>
      </div>

      {/* Connected Integration Status & Quick Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base text-slate-900">Connected Storefront</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              Shopify Active
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Apex Luxury Lifestyle</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">apex-luxury.myshopify.com</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Public Store Key:</span>
                <div className="font-mono text-xs text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 mt-1">
                  pub_live_apex_9a8b7c6d5e4f3a2b1c
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Link
                href="/rules"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
              >
                <Sliders className="w-4 h-4" />
                Configure Pricing Rules
              </Link>
              <Link
                href="/widget-sandbox"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Test Negotiation Simulator
              </Link>
            </div>
          </div>
        </div>

        {/* Protection Invariant Notice */}
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base mb-1">Zero Floor Leakage Policy</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your floor price (₹1,500) is locked behind our server-side deterministic interceptor.
              Even if an AI model hallucinates or an attacker attempts prompt injection, no offer below
              your floor will ever be finalized.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400">
            Active Provider: <span className="text-emerald-400 font-semibold uppercase">Deterministic Guard + AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
