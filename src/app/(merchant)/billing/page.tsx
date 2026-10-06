"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Download,
  Check,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export default function MerchantBillingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch("/api/v1/merchant/billing");
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setBillingData(json);
          }
        }
      } catch (err) {
        console.error("Failed to load billing:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, []);

  const invoices = [
    { id: "INV-2026-003", date: "Oct 1, 2026", amount: "$99.00", status: "Paid", period: "Oct 1 - Oct 31, 2026" },
    { id: "INV-2026-002", date: "Sep 1, 2026", amount: "$99.00", status: "Paid", period: "Sep 1 - Sep 30, 2026" },
    { id: "INV-2026-001", date: "Aug 1, 2026", amount: "$99.00", status: "Paid", period: "Aug 1 - Aug 31, 2026" },
  ];

  const currentPlanName = billingData?.subscription?.planName || "Growth Plan";
  const monthlyPrice = billingData?.subscription?.monthlyPriceUsd ?? 99;
  const status = billingData?.subscription?.status || "ACTIVE";
  const usedSessions = billingData?.usage?.used ?? 142;
  const maxSessions = billingData?.usage?.limit ?? 1500;
  const usagePct = billingData?.usage?.percentage ?? Math.min(100, Number(((usedSessions / maxSessions) * 100).toFixed(1)));
  const isCapped = billingData?.usage?.isQuotaExceeded || false;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}>
            {currentPlanName} Active
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Manage your NegoZaar SaaS subscription tier, monthly negotiation session quotas, and payment receipts.
        </p>
      </div>

      {/* Current Active Plan & Quota Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                Current Active Subscription
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{currentPlanName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Billed monthly at <strong className="text-slate-800">${monthlyPrice}.00/mo</strong>. Next renewal on Nov 1, 2026.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {status}
            </span>
          </div>

          {/* Usage Meter */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-700">Monthly Negotiation Sessions</span>
              <span className="text-slate-900 font-bold">
                {usedSessions} / {maxSessions.toLocaleString()} used ({usagePct}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCapped ? "bg-rose-500" : usagePct > 80 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, usagePct)}%` }}
              />
            </div>
            {isCapped && (
              <p className="text-[11px] font-semibold text-rose-600">
                Warning: Monthly negotiation quota reached. Please upgrade to continue auto-negotiating.
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Your quota resets automatically on the 1st of every month. Unused sessions do not roll over.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Includes 100% Deterministic Price Protection Guard</span>
            </div>
            <button
              onClick={() => alert("Redirecting to secure Stripe Customer Portal session...")}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
            >
              Manage in Stripe Portal
            </button>
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100 mb-4">
              Payment Method
            </h3>
            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="w-10 h-7 rounded bg-slate-800 text-white flex items-center justify-center font-bold text-xs tracking-wider">
                MC
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Mastercard ending in 4242</div>
                <div className="text-[11px] text-slate-400">Expires 08/2028 • Default</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => alert("Payment methods will be updated via Stripe in the upcoming payment phase.")}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
            >
              Update Payment Card
            </button>
          </div>
        </div>
      </div>

      {/* Available Plans Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Subscription Plans</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent pricing designed to scale with your ecommerce store volume.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Starter Plan */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Starter</h4>
              <p className="text-xs text-slate-500 mt-0.5">For boutique stores testing dynamic negotiation.</p>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900">$29</span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>

              <ul className="mt-5 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Up to 1,000 negotiation sessions/mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>1 connected Shopify store</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Deterministic floor price guard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Standard AI negotiation model</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => alert("Plan changes will be handled through Stripe billing in Phase 5.")}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                Downgrade to Starter
              </button>
            </div>
          </div>

          {/* Growth Plan (Current) */}
          <div className="p-5 rounded-xl border-2 border-emerald-600 bg-emerald-50/20 relative flex flex-col justify-between shadow-xs">
            <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
              Current Plan
            </span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Growth</h4>
              <p className="text-xs text-slate-500 mt-0.5">For growing brands maximizing cart conversion.</p>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900">$99</span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>

              <ul className="mt-5 space-y-2.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Up to 5,000 negotiation sessions/mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Up to 3 connected stores</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Deterministic pricing guardrail</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Custom LLM strategy curves</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Full conversation inspector console</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-emerald-100">
              <button
                disabled
                className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-default"
              >
                Active Plan
              </button>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Enterprise</h4>
              <p className="text-xs text-slate-500 mt-0.5">For high-volume retail brands & marketplaces.</p>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900">$399</span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>

              <ul className="mt-5 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Unlimited negotiation sessions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Unlimited storefronts & multi-tenant domains</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Fine-tuned domain-specific LLMs</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Dedicated Slack channel & 99.9% uptime SLA</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => alert("Contact enterprise sales at sales@negozaar.com for custom terms.")}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition"
              >
                Contact Enterprise Sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Billing History & Invoices</h3>
          <p className="text-xs text-slate-500 mt-0.5">Download previous statements and receipts.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-6">Invoice Number</th>
                <th className="py-3 px-6">Billing Period</th>
                <th className="py-3 px-6">Amount</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-6 font-mono font-medium text-slate-900">{inv.id}</td>
                  <td className="py-3.5 px-6 text-slate-600">{inv.period}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900">{inv.amount}</td>
                  <td className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      onClick={() => alert(`Downloading PDF invoice for ${inv.id}...`)}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
