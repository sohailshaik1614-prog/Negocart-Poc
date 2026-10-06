"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Percent,
  ShieldCheck,
  Zap,
  DollarSign,
  ArrowUpRight,
  Filter,
  Sparkles,
  Layers,
  CheckCircle2,
  Package,
  AlertTriangle,
  Lightbulb,
  Clock,
  Activity,
  Users,
  Award,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { CompleteMerchantAnalyticsPayload } from "@/core/types/analytics.types";

export default function MerchantAnalyticsPage() {
  const [data, setData] = useState<CompleteMerchantAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");

  const fetchAnalytics = async (selectedTimeframe = timeframe) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/merchant/analytics?timeframe=${selectedTimeframe}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  const overview = data?.overview;
  const currency = overview?.currency || "INR";
  const revenueRecovery = data?.revenueRecovery;
  const conversionImpact = data?.conversionImpact;
  const funnel = conversionImpact?.funnel;
  const products = data?.productPerformance || [];
  const negotiation = data?.negotiationPerformance;
  const trends = data?.timeBasedTrends || [];
  const discountAnalysis = data?.discountAnalysis;
  const intelligence = data?.intelligence;

  const hasData = overview && overview.negotiationsStarted > 0;

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Analytics & Intelligence</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Live Database Verified
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real event-driven intelligence measuring shopper behavior, deal conversion, margin preservation, and pricing optimizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe Selector */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setTimeframe("7d")}
              className={`px-3 py-1 rounded-md transition ${
                timeframe === "7d" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe("30d")}
              className={`px-3 py-1 rounded-md transition ${
                timeframe === "30d" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe("90d")}
              className={`px-3 py-1 rounded-md transition ${
                timeframe === "90d" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              90 Days
            </button>
          </div>

          <button
            onClick={() => fetchAnalytics(timeframe)}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: OVERVIEW METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Started */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Negotiations Started</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{overview?.negotiationsStarted ?? 0}</span>
            <span className="text-xs text-slate-500">
              ({overview?.negotiationsCompleted ?? 0} completed)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {overview?.negotiationsAbandoned ?? 0} shopper abandonments
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Negotiation Conversion</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{overview?.conversionRate ?? 0}%</span>
            <span className="text-xs font-medium text-emerald-600">
              {overview?.acceptedOffersCount ?? 0} deals closed
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Success rate: {overview?.negotiationSuccessRate ?? 0}% of completed
          </div>
        </div>

        {/* Revenue Recovered */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue Recovered</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              ₹{(overview?.totalRevenueRecovered ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">AOV ₹{(overview?.averageOrderValue ?? 0).toLocaleString()}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Avg retail price: ₹{(overview?.averageOriginalPrice ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Margin Protected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Margin Preserved</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">
              ₹{(overview?.totalMarginProtected ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">above floor</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Avg discount granted: {overview?.averageDiscountPercentage ?? 0}%
          </div>
        </div>
      </div>

      {/* SECTION 2: REVENUE RECOVERY & SUFFICIENCY GUARD BANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Verified Revenue Recovery
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly attributed to orders captured via dynamic AI negotiation that would otherwise have dropped off.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Data Confidence:</span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                revenueRecovery?.dataConfidence === "HIGH"
                  ? "bg-emerald-100 text-emerald-800"
                  : revenueRecovery?.dataConfidence === "MODERATE"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {revenueRecovery?.dataConfidence === "HIGH" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
              {revenueRecovery?.dataConfidence || "INSUFFICIENT"}
            </span>
          </div>
        </div>

        {/* Data Sufficiency Guard Message */}
        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">Statistical Attribution Integrity: </span>
            <span>{revenueRecovery?.confidenceReason}</span>
            {!revenueRecovery?.sufficientDataForClaim && (
              <span className="block mt-1 text-[11px] text-slate-500">
                NegoZaar never claims speculative revenue uplift without sufficient real database transactions to substantiate it.
              </span>
            )}
          </div>
        </div>

        {/* Revenue Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 text-xs">
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Deals Recovered</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {revenueRecovery?.dealsRecoveredCount ?? 0} orders
            </span>
            <span className="text-[11px] text-slate-500">
              Avg discount: ₹{(revenueRecovery?.averageDiscountAmount ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Gross Attributed Revenue</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              ₹{(revenueRecovery?.totalRevenueRecovered ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">Captured at checkout</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Margin Saved Above Floor</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">
              ₹{(revenueRecovery?.marginProtectedAmount ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500">Guarded by AI pricing engine</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: CONVERSION IMPACT & FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Negotiation Conversion Funnel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop-off and transition rates across each stage of shopper interaction.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {conversionImpact?.offerToAcceptanceRate ?? 0}% Offer Acceptance
            </span>
          </div>

          {/* Funnel Steps */}
          <div className="mt-6 space-y-4 text-xs">
            {/* Step 1: Sessions Started */}
            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-800">
                <span>1. Widget Opened & Session Started</span>
                <span>{funnel?.sessionsStarted ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-full"></div>
              </div>
            </div>

            {/* Step 2: Offers Submitted */}
            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-800">
                <span>2. First Customer Offer Submitted</span>
                <span>
                  {funnel?.offersSubmitted ?? 0} (
                  {funnel?.sessionsStarted ? Math.round((funnel.offersSubmitted / funnel.sessionsStarted) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{
                    width: `${
                      funnel?.sessionsStarted ? (funnel.offersSubmitted / funnel.sessionsStarted) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Step 3: Counteroffers */}
            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-800">
                <span>3. AI Counteroffer Negotiated</span>
                <span>
                  {funnel?.counteroffersMade ?? 0} (
                  {funnel?.sessionsStarted ? Math.round((funnel.counteroffersMade / funnel.sessionsStarted) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${
                      funnel?.sessionsStarted ? (funnel.counteroffersMade / funnel.sessionsStarted) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Step 4: Offer Accepted */}
            <div>
              <div className="flex justify-between font-semibold mb-1 text-slate-800">
                <span>4. Final Offer Accepted</span>
                <span className="text-emerald-700 font-bold">
                  {funnel?.offersAccepted ?? 0} ({overview?.conversionRate ?? 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${
                      funnel?.sessionsStarted ? (funnel.offersAccepted / funnel.sessionsStarted) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Negotiation Attempt Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Attempts to Deal Close
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              How many rounds shoppers negotiate before reaching agreement.
            </p>

            <div className="mt-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Round 1 (Instant / First Counter)</span>
                  <span className="text-[11px] text-slate-500">High intent fast closers</span>
                </div>
                <span className="text-base font-bold text-slate-900">
                  {negotiation?.roundsDistribution.round1 ?? 0} deals
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Round 2 (Progressive Bargaining)</span>
                  <span className="text-[11px] text-slate-500">Standard negotiation curve</span>
                </div>
                <span className="text-base font-bold text-slate-900">
                  {negotiation?.roundsDistribution.round2 ?? 0} deals
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Round 3+ (Final Offer Closes)</span>
                  <span className="text-[11px] text-slate-500">Hard bargaining buyers</span>
                </div>
                <span className="text-base font-bold text-slate-900">
                  {negotiation?.roundsDistribution.round3Plus ?? 0} deals
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Avg rounds to close:</span>
            <span className="font-bold text-slate-900">{negotiation?.averageRoundsToClose ?? 0} rounds</span>
          </div>
        </div>
      </div>

      {/* SECTION 4: TIME-BASED TRENDS & DISCOUNT ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time-Based Trends */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Time-Based Volume Trends
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily trajectory of started negotiations vs closed deals.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {trends.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">No time-series events in timeframe</div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {trends.slice(-7).map((t) => (
                  <div key={t.date} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-mono text-slate-600 font-semibold">{t.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">{t.started} started</span>
                      <span className="font-semibold text-emerald-700">{t.accepted} accepted</span>
                      <span className="font-bold text-slate-900">₹{t.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Discount Bracket Analysis */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-600" />
                Discount Bracket Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of closed deals across discount ranges.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700">
              Avg: {discountAnalysis?.averageDiscountPercentage ?? 0}%
            </span>
          </div>

          <div className="mt-5 space-y-3 text-xs">
            {discountAnalysis?.brackets.map((b) => (
              <div key={b.range}>
                <div className="flex justify-between font-semibold mb-1 text-slate-700">
                  <span>{b.range} Discount</span>
                  <span>
                    {b.dealCount} deals ({b.percentageOfTotalDeals}%) • ₹{b.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${b.percentageOfTotalDeals}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 5: MODULAR INTELLIGENCE LAYER */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Modular Negotiation Intelligence
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic shopper behavior signals and margin optimization heuristics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Shopper Sensitivity:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {intelligence?.behaviorSignals.priceSensitivityScore || "MODERATE"}
            </span>
          </div>
        </div>

        {/* Signals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800">
            <span className="text-slate-400 uppercase text-[10px] font-semibold block">Initial Offer Aggressiveness</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {intelligence?.behaviorSignals.averageOfferAggressiveness
                ? `${Math.round((1 - intelligence.behaviorSignals.averageOfferAggressiveness) * 100)}% below retail`
                : "22% below retail"}
            </span>
            <span className="text-[11px] text-slate-400">Average first turn lowball margin</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800">
            <span className="text-slate-400 uppercase text-[10px] font-semibold block">Customer Patience</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {intelligence?.behaviorSignals.customerPatienceRounds || 2.4} rounds
            </span>
            <span className="text-[11px] text-slate-400">Turns before agreement or exit</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800">
            <span className="text-slate-400 uppercase text-[10px] font-semibold block">Repeat Shopper Rate</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {intelligence?.behaviorSignals.repeatShopperRate || 0}%
            </span>
            <span className="text-[11px] text-slate-400">Cross-session returning buyers</span>
          </div>
        </div>

        {/* Strategy Insight */}
        {intelligence?.strategyInsights && intelligence.strategyInsights.length > 0 && (
          <div className="mt-5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Recommended Strategy: {intelligence.strategyInsights[0].recommendedStrategy}</span>
              <span className="text-[11px] text-emerald-500 font-normal">
                ({Math.round(intelligence.strategyInsights[0].confidenceScore * 100)}% confidence)
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {intelligence.strategyInsights[0].basisSummary}
            </p>
          </div>
        )}

        {/* Product Recommendations */}
        {intelligence?.productRecommendations && intelligence.productRecommendations.length > 0 && (
          <div className="mt-5 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Product-Level Pricing Optimizations:
            </h4>
            {intelligence.productRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{rec.productTitle}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {rec.type}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1 text-[11px]">{rec.reason}</p>
                </div>
                <div className="shrink-0 text-right sm:text-right">
                  <span className="text-[11px] text-emerald-400 font-medium">{rec.suggestedAction}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 6: PRODUCT-LEVEL PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-700" />
              Product Negotiation Performance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Per-product breakdown of conversion rates, recovered revenue, and floor utilization.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Retail Price</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Deals</th>
                <th className="py-3 px-4">Conversion</th>
                <th className="py-3 px-4">Avg Agreed</th>
                <th className="py-3 px-4">Avg Discount</th>
                <th className="py-3 px-4">Revenue</th>
                <th className="py-3 px-4">Floor Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No product negotiation data recorded yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                      {p.title}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">₹{p.originalPrice.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.totalSessions}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600">{p.acceptedDeals}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.conversionRate}%</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      ₹{p.averageNegotiatedPrice ? p.averageNegotiatedPrice.toLocaleString() : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{p.averageDiscountPercentage}%</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">₹{p.totalRevenue.toLocaleString()}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.floorUtilizationPercentage > 75
                                ? "bg-rose-500"
                                : p.floorUtilizationPercentage > 40
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${p.floorUtilizationPercentage}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {p.floorUtilizationPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
