"use client";

import React, { useState, useEffect } from "react";
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
  ExternalLink,
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Layers,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";

interface AnalyticsMetrics {
  totalNegotiations: number;
  totalCompleted: number;
  acceptedOffersCount: number;
  conversionRate: number;
  averageDiscountPercentage: number;
  totalNegotiatedRevenue: number;
  averageNegotiatedPrice: number;
  totalMarginProtected: number;
  currency: string;
}

interface RecentSession {
  id: string;
  customerId: string;
  productId: string;
  productTitle?: string;
  productSku?: string;
  originalPrice: number;
  finalAgreedPrice?: number;
  currentCustomerOffer?: number;
  currentRound: number;
  maxRounds: number;
  status: "ACTIVE" | "COUNTERED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "TERMINATED";
  createdAt: string;
}

export default function MerchantDashboardPage() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const publicStoreKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real analytics and real sessions in parallel
      const [analyticsRes, sessionsRes] = await Promise.all([
        fetch("/api/v1/merchant/analytics"),
        fetch("/api/v1/merchant/sessions"),
      ]);

      if (!analyticsRes.ok) {
        throw new Error(`Failed to load analytics: ${analyticsRes.statusText}`);
      }
      if (!sessionsRes.ok) {
        throw new Error(`Failed to load sessions: ${sessionsRes.statusText}`);
      }

      const analyticsData = await analyticsRes.json();
      const sessionsData = await sessionsRes.json();

      if (analyticsData.success) {
        setMetrics(analyticsData.metrics);
      }

      if (sessionsData.success && sessionsData.data?.sessions) {
        // Show up to 5 most recent sessions
        setRecentSessions(sessionsData.data.sessions.slice(0, 5));
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const copyStoreKey = () => {
    navigator.clipboard.writeText(publicStoreKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatCurrency = (val: number, currency = "INR") => {
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
    return `${symbol}${val.toLocaleString()}`;
  };

  const getStatusBadge = (status: RecentSession["status"]) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Accepted
          </span>
        );
      case "COUNTERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Countered
          </span>
        );
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Active
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Rejected
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Expired
          </span>
        );
      case "TERMINATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Closed
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Merchant Dashboard</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              Live Database
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time negotiation volume, recovered revenue, and price protection metrics for{" "}
            <span className="font-semibold text-slate-700">Apex Luxury Lifestyle</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
          <Link
            href="/widget-sandbox"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch Simulator
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="text-xs font-semibold underline hover:no-underline text-rose-900"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Primary KPI Grid (7 Core SaaS Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Negotiations Started */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Negotiations Started
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {metrics?.totalNegotiations ?? 0}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Total customer sessions initiated</p>
          </div>
        </div>

        {/* Metric 2: Negotiations Completed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Negotiations Completed
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {metrics?.totalCompleted ?? 0}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Concluded negotiation lifecycles</p>
          </div>
        </div>

        {/* Metric 3: Deals Accepted */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Deals Accepted
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600">
                {metrics?.acceptedOffersCount ?? 0}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Claimable coupons unlocked</p>
          </div>
        </div>

        {/* Metric 4: Conversion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conversion Rate
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {metrics?.conversionRate ?? 0}%
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Accepted deals / total sessions</p>
          </div>
        </div>

        {/* Metric 5: Revenue Recovered */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Revenue Recovered
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(metrics?.totalNegotiatedRevenue ?? 0, metrics?.currency)}
              </div>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-1">High-intent recovered GMV</p>
          </div>
        </div>

        {/* Metric 6: Average Discount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Discount
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {metrics?.averageDiscountPercentage ?? 0}%
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Conceded vs listed retail price</p>
          </div>
        </div>

        {/* Metric 7: Average Negotiated Price */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg Negotiated Price
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(metrics?.averageNegotiatedPrice ?? 0, metrics?.currency)}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">Mean accepted order basket value</p>
          </div>
        </div>

        {/* Metric 8: Margin Protected by Guardrail */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Margin Protected
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(metrics?.totalMarginProtected ?? 0, metrics?.currency)}
              </div>
            )}
            <p className="text-xs text-purple-600 font-medium mt-1">Retained above floor limits</p>
          </div>
        </div>
      </div>

      {/* Main Content Area: Recent Activity & Quick Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Negotiations Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Customer Negotiations</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time sessions flowing through your connected storefront widget
              </p>
            </div>
            <Link
              href="/negotiations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <span>View All Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              /* EMPTY STATE: Actionable onboarding guide */
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <History className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No negotiations recorded yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  When customers start bargaining on your store, real sessions and conversations will appear here.
                  Get started by following the setup steps below.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left max-w-lg mx-auto">
                  <Link
                    href="/products"
                    className="p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 transition group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between">
                      <span>1. Configure Rules</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Set secret floor prices on products</p>
                  </Link>

                  <Link
                    href="/integrations"
                    className="p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 transition group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between">
                      <span>2. Embed Script</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Install NegoZaar tag in Shopify</p>
                  </Link>

                  <Link
                    href="/widget-sandbox"
                    className="p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 transition group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between">
                      <span>3. Test Sandbox</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Simulate live negotiation round</p>
                  </Link>
                </div>
              </div>
            ) : (
              /* REAL SESSIONS LIST */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3 pl-1">Session / Customer</th>
                      <th className="pb-3">Product</th>
                      <th className="pb-3 text-center">Rounds</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Negotiated Price</th>
                      <th className="pb-3 text-right pr-1">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/80 transition group">
                        <td className="py-3 pl-1">
                          <div className="font-mono font-medium text-slate-900">
                            #{session.id.slice(0, 8)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {session.customerId.slice(0, 14)}
                          </div>
                        </td>
                        <td className="py-3 max-w-[160px] truncate">
                          <div className="font-medium text-slate-800 truncate">
                            {session.productTitle || `Product #${session.productId.slice(0, 6)}`}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Listed: {formatCurrency(session.originalPrice, metrics?.currency)}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-mono text-slate-700">
                            {session.currentRound}/{session.maxRounds}
                          </span>
                        </td>
                        <td className="py-3">{getStatusBadge(session.status)}</td>
                        <td className="py-3 text-right font-medium text-slate-900">
                          {session.finalAgreedPrice
                            ? formatCurrency(session.finalAgreedPrice, metrics?.currency)
                            : session.currentCustomerOffer
                            ? formatCurrency(session.currentCustomerOffer, metrics?.currency)
                            : "—"}
                        </td>
                        <td className="py-3 text-right pr-1">
                          <Link
                            href={`/negotiations`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                          >
                            Inspect
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Connected Storefront & Protection Status */}
        <div className="space-y-6">
          {/* Connected Storefront Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-900">Connected Storefront</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Shopify Live
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div>
                <div className="font-medium text-sm text-slate-900">Apex Luxury Lifestyle</div>
                <div className="text-xs text-slate-500 font-mono">apex-luxury.myshopify.com</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Public Store Key</span>
                  <button
                    onClick={copyStoreKey}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3 h-3" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-800 truncate bg-white p-1.5 rounded border border-slate-200">
                  {publicStoreKey}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/products"
                  className="w-full text-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
                >
                  Manage Product Rules & Floors
                </Link>
                <Link
                  href="/integrations"
                  className="w-full text-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                >
                  View Integration & Embed Tag
                </Link>
              </div>
            </div>
          </div>

          {/* Zero Floor Leakage Policy Card */}
          <div className="bg-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm mb-1">Zero Floor Leakage Policy</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Merchant minimum acceptable prices are locked behind server-side deterministic guards.
                Even if prompt injection is attempted, no offer below your secret floor will ever be accepted.
              </p>
            </div>
            <div className="pt-3 mt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Guard Engine:</span>
              <span className="text-emerald-400 font-semibold uppercase">Deterministic Guard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
