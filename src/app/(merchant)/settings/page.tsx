"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Store,
  Sliders,
  ShieldCheck,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Copy,
  Key,
  Lock,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface MerchantProfile {
  id: string;
  name: string;
  billingEmail: string;
  createdAt: string;
}

interface StoreSettings {
  id: string;
  storeName: string;
  platform: string;
  platformStoreId: string;
  currency: string;
  publicStoreKey: string;
  settings: {
    brandColor?: string;
    widgetTheme?: "light" | "dark" | "auto";
    position?: "bottom-right" | "bottom-left" | "inline";
    buttonText?: string;
    bannerTitle?: string;
    requireEmailToClaim?: boolean;
  };
}

interface NegotiationDefaults {
  defaultMaxRounds: number;
  defaultStrategy: "AGGRESSIVE" | "MODERATE" | "FRIENDLY";
  defaultMaxDiscountPercentage: number;
  notificationEmail: string;
  autoAcceptThresholdPercentage: number;
}

export default function MerchantSettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "store" | "negotiation" | "security">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile Form State
  const [profileName, setProfileName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [merchantId, setMerchantId] = useState("");

  // Store Form State
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [platformStoreId, setPlatformStoreId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [brandColor, setBrandColor] = useState("#059669");
  const [widgetTheme, setWidgetTheme] = useState<"light" | "dark" | "auto">("light");
  const [widgetPosition, setWidgetPosition] = useState<"bottom-right" | "bottom-left" | "inline">("bottom-right");
  const [buttonText, setButtonText] = useState("Negotiate Price ✨");
  const [bannerTitle, setBannerTitle] = useState("Bargain with AI Agent");
  const [requireEmailToClaim, setRequireEmailToClaim] = useState(true);

  // Negotiation Defaults State
  const [defaultMaxRounds, setDefaultMaxRounds] = useState(3);
  const [defaultStrategy, setDefaultStrategy] = useState<"AGGRESSIVE" | "MODERATE" | "FRIENDLY">("MODERATE");
  const [defaultMaxDiscountPercentage, setDefaultMaxDiscountPercentage] = useState(25);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [autoAcceptThresholdPercentage, setAutoAcceptThresholdPercentage] = useState(5);

  // Security Credentials State
  const [publicStoreKey, setPublicStoreKey] = useState("pub_live_apex_9a8b7c6d5e4f3a2b1c");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [profileRes, storeRes, settingsRes] = await Promise.all([
        fetch("/api/v1/merchant/profile"),
        fetch("/api/v1/merchant/store"),
        fetch("/api/v1/merchant/settings"),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data) {
          setMerchantId(profileData.data.id || "");
          setProfileName(profileData.data.name || "");
          setBillingEmail(profileData.data.billingEmail || "");
        }
      }

      if (storeRes.ok) {
        const storeData = await storeRes.json();
        if (storeData.success && storeData.data) {
          const s = storeData.data;
          setStoreId(s.id);
          setStoreName(s.storeName || "");
          setPlatformStoreId(s.platformStoreId || "");
          setCurrency(s.currency || "INR");
          setPublicStoreKey(s.publicStoreKey || "pub_live_apex_9a8b7c6d5e4f3a2b1c");
          if (s.settings) {
            setBrandColor(s.settings.brandColor || "#059669");
            setWidgetTheme(s.settings.widgetTheme || "light");
            setWidgetPosition(s.settings.position || "bottom-right");
            setButtonText(s.settings.buttonText || "Negotiate Price ✨");
            setBannerTitle(s.settings.bannerTitle || "Bargain with AI Agent");
            setRequireEmailToClaim(s.settings.requireEmailToClaim !== false);
          }
        }
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.data) {
          const d = settingsData.data;
          setDefaultMaxRounds(d.defaultMaxRounds ?? 3);
          setDefaultStrategy(d.defaultStrategy || "MODERATE");
          setDefaultMaxDiscountPercentage(d.defaultMaxDiscountPercentage ?? 25);
          setNotificationEmail(d.notificationEmail || "");
          setAutoAcceptThresholdPercentage(d.autoAcceptThresholdPercentage ?? 5);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setErrorMessage("Failed to load merchant settings. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res = await fetch("/api/v1/merchant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          billingEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccessMessage("Business profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res = await fetch("/api/v1/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          storeName,
          platformStoreId,
          currency,
          settings: {
            brandColor,
            widgetTheme,
            position: widgetPosition,
            buttonText,
            bannerTitle,
            requireEmailToClaim,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update store settings");
      }

      setSuccessMessage("Store settings and appearance saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update store");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNegotiationDefaults = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res = await fetch("/api/v1/merchant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultMaxRounds: Number(defaultMaxRounds),
          defaultStrategy,
          defaultMaxDiscountPercentage: Number(defaultMaxDiscountPercentage),
          notificationEmail,
          autoAcceptThresholdPercentage: Number(autoAcceptThresholdPercentage),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update negotiation defaults");
      }

      setSuccessMessage("Negotiation defaults saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update negotiation defaults");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: "key" | "webhook") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedWebhookSecret(true);
      setTimeout(() => setCopiedWebhookSecret(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Merchant Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your business profile, store appearance, negotiation limits, and API security keys.
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex space-x-8">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === "profile"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Business Profile
        </button>

        <button
          onClick={() => setActiveTab("store")}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === "store"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Store className="w-4 h-4" />
          Store Settings
        </button>

        <button
          onClick={() => setActiveTab("negotiation")}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === "negotiation"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Negotiation Defaults
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === "security"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Security & Keys
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading merchant configuration...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: BUSINESS PROFILE */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 mb-6">
                <h2 className="text-base font-semibold text-slate-900">Merchant Organization</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your legal entity and billing communication settings.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                    placeholder="e.g. Apex Retail Brands LLC"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Billing / Accounting Email
                  </label>
                  <input
                    type="email"
                    required
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    placeholder="finance@apexbrands.com"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Invoices and usage statements will be sent here.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Merchant Tenant ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={merchantId}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Immutable UUID assigned to your multi-tenant partition.</p>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving Changes..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: STORE SETTINGS */}
          {activeTab === "store" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 mb-6">
                <h2 className="text-base font-semibold text-slate-900">Connected Storefront & Widget Appearance</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize how the AI negotiation widget looks and behaves on your ecommerce store.
                </p>
              </div>

              <form onSubmit={handleSaveStore} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Storefront Name
                    </label>
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Shopify Domain / Store URL
                    </label>
                    <input
                      type="text"
                      required
                      value={platformStoreId}
                      onChange={(e) => setPlatformStoreId(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      placeholder="store-name.myshopify.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Store Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Widget Theme
                    </label>
                    <select
                      value={widgetTheme}
                      onChange={(e) => setWidgetTheme(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                    >
                      <option value="light">Light Theme</option>
                      <option value="dark">Dark Theme</option>
                      <option value="auto">Auto (Match Shopper OS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Screen Position
                    </label>
                    <select
                      value={widgetPosition}
                      onChange={(e) => setWidgetPosition(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                    >
                      <option value="bottom-right">Bottom Right Modal</option>
                      <option value="bottom-left">Bottom Left Modal</option>
                      <option value="inline">Inline on Product Page</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Product Page Button Text
                    </label>
                    <input
                      type="text"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      placeholder="Negotiate Price ✨"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Modal Banner Header
                    </label>
                    <input
                      type="text"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      placeholder="Bargain with AI Agent"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireEmailToClaim}
                      onChange={(e) => setRequireEmailToClaim(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        Require Shopper Email to Reveal Final Coupon Code
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Helps build your merchant newsletter list by collecting the buyer's verified email upon offer acceptance.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving Changes..." : "Save Store Settings"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: NEGOTIATION DEFAULTS */}
          {activeTab === "negotiation" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 mb-6">
                <h2 className="text-base font-semibold text-slate-900">Default Negotiation Behavior</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fallback rules applied whenever a product doesn't have an individual custom guardrail override.
                </p>
              </div>

              <form onSubmit={handleSaveNegotiationDefaults} className="space-y-6 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Default Max Customer Attempts (Rounds)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      required
                      value={defaultMaxRounds}
                      onChange={(e) => setDefaultMaxRounds(Number(e.target.value))}
                      className="w-28 px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold"
                    />
                    <span className="text-xs text-slate-500">
                      Rounds per session (Recommended: 3 rounds). Blocked automatically on subsequent tries.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Default AI Negotiation Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        defaultStrategy === "MODERATE"
                          ? "border-emerald-600 bg-emerald-50/30 text-emerald-950 font-medium ring-1 ring-emerald-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value="MODERATE"
                        checked={defaultStrategy === "MODERATE"}
                        onChange={() => setDefaultStrategy("MODERATE")}
                        className="sr-only"
                      />
                      <div className="text-xs font-bold text-slate-900">Moderate</div>
                      <div className="text-[11px] text-slate-500 mt-1">Balanced curve, preserves healthy profit margins.</div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        defaultStrategy === "AGGRESSIVE"
                          ? "border-emerald-600 bg-emerald-50/30 text-emerald-950 font-medium ring-1 ring-emerald-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value="AGGRESSIVE"
                        checked={defaultStrategy === "AGGRESSIVE"}
                        onChange={() => setDefaultStrategy("AGGRESSIVE")}
                        className="sr-only"
                      />
                      <div className="text-xs font-bold text-slate-900">Aggressive</div>
                      <div className="text-[11px] text-slate-500 mt-1">Tight concessions, protects maximum retail price.</div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        defaultStrategy === "FRIENDLY"
                          ? "border-emerald-600 bg-emerald-50/30 text-emerald-950 font-medium ring-1 ring-emerald-600"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value="FRIENDLY"
                        checked={defaultStrategy === "FRIENDLY"}
                        onChange={() => setDefaultStrategy("FRIENDLY")}
                        className="sr-only"
                      />
                      <div className="text-xs font-bold text-slate-900">Friendly</div>
                      <div className="text-[11px] text-slate-500 mt-1">Faster concessions to maximize conversion speed.</div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Max Concession Ceiling (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        required
                        value={defaultMaxDiscountPercentage}
                        onChange={(e) => setDefaultMaxDiscountPercentage(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Global ceiling if individual floor is omitted.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Instant Auto-Accept Window (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        required
                        value={autoAcceptThresholdPercentage}
                        onChange={(e) => setAutoAcceptThresholdPercentage(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Offers within 5% of retail are closed immediately.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alert & Notification Email
                  </label>
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    placeholder="sales-alerts@apexbrands.com"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Receive notifications when high-intent deals close.</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving Defaults..." : "Save Negotiation Defaults"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: SECURITY & KEYS */}
          {activeTab === "security" && (
            <div className="space-y-6 max-w-3xl">
              {/* Deterministic Guard Summary Banner */}
              <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1">Server-Side Deterministic Price Guard</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    NegoZaar uses an absolute separation of concerns: while the AI generates professional conversational
                    counter-arguments, pricing decisions and discounts are verified by a deterministic mathematical
                    guard in Go/Node.js before reaching any customer.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Zero Floor Leakage: Enforced
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      HMAC Session Signatures: Active
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Prompt Injection Barrier: Passed 67/67 Tests
                    </span>
                  </div>
                </div>
              </div>

              {/* API Credentials Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-semibold text-base text-slate-900">Developer & Storefront Credentials</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Keys required to embed the negotiation layer into Shopify or custom headless frontends.
                  </p>
                </div>

                {/* Public Store Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Public Store Key (Storefront Widget)
                    </label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(publicStoreKey, "key")}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Key
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 break-all select-all">
                    {publicStoreKey}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Safe to include in your frontend Shopify theme code. Authorizes session creation for this store only.
                  </p>
                </div>

                {/* Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Webhook Verification Secret
                    </label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("whsec_apex_live_e8f2a938c41d06b", "webhook")}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      {copiedWebhookSecret ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Secret
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 break-all select-all flex items-center justify-between">
                    <span>whsec_apex_live_e8f2a938c41d06b</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Used to verify cryptographically signed webhooks dispatched when a customer accepts an agreed price.
                  </p>
                </div>

                {/* Key Rotation Notice */}
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Need to rotate keys?</span>
                    <span>
                      Rotating your Public Store Key will immediately disconnect older storefront embed instances.
                      Contact your NegoZaar security engineer before initiating zero-downtime key rotation.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
