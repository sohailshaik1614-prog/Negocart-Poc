"use client";

import React, { useState, useEffect } from "react";
import { Sliders, ShieldCheck, Check, AlertTriangle, Save, Sparkles } from "lucide-react";
import { NegotiationStrategy } from "@/core/types/rule.types";

export default function PricingRulesPage() {
  const [storeId] = useState("d0000000-0000-0000-0000-000000000001");
  const [productId] = useState("e0000000-0000-0000-0000-000000000001");

  const [listedPrice] = useState(2000);
  const [floorPrice, setFloorPrice] = useState<number>(1500);
  const [maxDiscountPct, setMaxDiscountPct] = useState<number>(25);
  const [autoAcceptPrice, setAutoAcceptPrice] = useState<number>(1850);
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [strategy, setStrategy] = useState<NegotiationStrategy>("MODERATE");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [customPrompt, setCustomPrompt] = useState<string>("Emphasize handmade craftsmanship and full-grain Italian leather.");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-calculate maximum allowed discount based on floor price
  const computedDiscountFromFloor = Number((((listedPrice - floorPrice) / listedPrice) * 100).toFixed(1));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (floorPrice > listedPrice) {
      setErrorMessage("Floor price cannot be higher than listed price");
      return;
    }
    if (floorPrice <= 0) {
      setErrorMessage("Floor price must be positive");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      setSaveSuccess(false);

      const res = await fetch("/api/v1/merchant/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId,
          isNegotiationEnabled: enabled,
          minAcceptablePrice: floorPrice,
          maxDiscountPercentage: maxDiscountPct,
          autoAcceptPrice: autoAcceptPrice || undefined,
          maxNegotiationRounds: maxRounds,
          strategy,
          minOrderQuantity: 1,
          couponValidityHours: 24,
          customSystemPromptAddon: customPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rule");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update pricing rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Negotiation & Pricing Rules</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure the deterministic pricing boundaries and negotiation strategy enforced by NegoZaar.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Selected Product Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Target Product
            </span>
            <h2 className="text-base font-semibold text-slate-900 mt-0.5">
              Artisan Leather Weekend Duffel Bag
            </h2>
            <p className="text-xs text-slate-500 font-mono">SKU: AL-BAG-001 | Listed Price: ₹{listedPrice.toLocaleString()}</p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-3 text-sm font-medium text-slate-700">
              {enabled ? "Negotiation Active" : "Disabled"}
            </span>
          </label>
        </div>

        {/* Pricing Guardrails Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-base text-slate-900">Deterministic Pricing Guardrails</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Acceptable Price (Floor Price)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={floorPrice}
                  onChange={(e) => setFloorPrice(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Absolute minimum floor. The AI will NEVER propose or accept below this amount.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Allowable Discount (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={maxDiscountPct}
                  onChange={(e) => setMaxDiscountPct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-medium">%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Current floor allows a maximum of {computedDiscountFromFloor}% discount.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Auto-Accept Threshold Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={autoAcceptPrice}
                  onChange={(e) => setAutoAcceptPrice(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Customer offers at or above this price are accepted instantly in Round 1.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Maximum Negotiation Rounds
              </label>
              <select
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value={2}>2 Rounds (Fast deal or walk)</option>
                <option value={3}>3 Rounds (Recommended standard)</option>
                <option value={4}>4 Rounds (Extended dialogue)</option>
                <option value={5}>5 Rounds (Maximum leeway)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                Final round automatically issues a take-it-or-leave-it offer.
              </p>
            </div>
          </div>
        </div>

        {/* AI Negotiation Strategy */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-base text-slate-900">Negotiation Strategy & Persona</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: "AGGRESSIVE",
                title: "Firm / Aggressive",
                desc: "Concedes very slowly. Holds listed price tightly until final round.",
              },
              {
                id: "MODERATE",
                title: "Moderate (Standard)",
                desc: "Balanced concessions towards fair midpoint. Best balance of margin & conversion.",
              },
              {
                id: "FRIENDLY",
                title: "Friendly / High Conversion",
                desc: "Concedes faster to secure quick customer checkout commitments.",
              },
            ].map((opt) => (
              <div
                key={opt.id}
                onClick={() => setStrategy(opt.id as NegotiationStrategy)}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  strategy === opt.id
                    ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="font-medium text-sm text-slate-900">{opt.title}</div>
                <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Custom Brand Voice / Value Talking Points
            </label>
            <textarea
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Highlight warranty, handcrafted quality, or free express shipping."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Pricing rules successfully saved and active in Deterministic Guard!</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Rules..." : "Save Pricing Rules"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
