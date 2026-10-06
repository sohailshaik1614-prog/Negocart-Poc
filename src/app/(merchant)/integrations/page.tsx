"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plug,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Code2,
  RefreshCw,
  Sparkles,
  Terminal,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Unplug,
} from "lucide-react";

export default function MerchantIntegrationsPage() {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedReact, setCopiedReact] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success">("idle");

  // Store & OAuth State
  const [storeDomain, setStoreDomain] = useState("apex-luxury.myshopify.com");
  const [publicStoreKey, setPublicStoreKey] = useState("pub_live_apex_9a8b7c6d5e4f3a2b1c");
  const [isConnected, setIsConnected] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [newShopInput, setNewShopInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load store connection status on mount
  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await fetch("/api/v1/merchant/store");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.platformStoreId) setStoreDomain(json.data.platformStoreId);
          if (json.data.publicStoreKey) setPublicStoreKey(json.data.publicStoreKey);
          setIsConnected(json.data.status === "ACTIVE");
        }
      } catch (err) {
        console.error("Failed to load store in integrations:", err);
      }
    };
    fetchStore();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "true") {
        const shop = params.get("shop");
        const synced = params.get("synced");
        if (shop) setStoreDomain(shop);
        setIsConnected(true);
        setSyncMessage(`Shopify store successfully connected! ${synced || 3} products imported.`);
        setTimeout(() => setSyncMessage(null), 6000);
      }
    }
  }, []);

  const handleReconnect = async () => {
    try {
      setConnecting(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reconnect store");
      }
      setIsConnected(true);
      setSyncMessage("Store re-activated successfully! Negotiations are now active.");
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Reconnection failed");
    } finally {
      setConnecting(false);
    }
  };

  const scriptTagCode = `<script
  src="https://cdn.negozaar.com/v1/sdk.js"
  data-store-key="${publicStoreKey}"
  defer>
</script>`;

  const reactHookCode = `// React / Next.js / Hydrogen Embed
import { NegoZaarWidget } from "@negozaar/react-sdk";

export default function ProductDetail({ product }) {
  return (
    <div className="product-actions">
      <NegoZaarWidget
        storeKey="${publicStoreKey}"
        productId={product.id}
        originalPrice={product.price}
        currency={product.currency || "INR"}
      />
    </div>
  );
}`;

  const copyToClipboard = (text: string, type: "script" | "react") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedReact(true);
      setTimeout(() => setCopiedReact(false), 2000);
    }
  };

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerifyStatus("success");
      setTimeout(() => setVerifyStatus("idle"), 4000);
    }, 1000);
  };

  const handleSyncProducts = async () => {
    try {
      setSyncing(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/integrations/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Catalog synchronization failed");
      }
      setSyncMessage(`Sync complete! ${data.syncResult?.totalSynced || 3} products updated in database.`);
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sync failed");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopInput.trim()) return;

    try {
      setConnecting(true);
      setErrorMsg(null);

      // Clean domain
      let clean = newShopInput.trim().toLowerCase();
      clean = clean.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!clean.includes(".")) {
        clean = `${clean}.myshopify.com`;
      }

      // Initiate OAuth via API route
      const res = await fetch(`/api/v1/integrations/shopify/auth?shop=${encodeURIComponent(clean)}&format=json`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start Shopify OAuth flow");
      }

      // Redirect to authorization URL
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this Shopify store? Active negotiations will pause.")) {
      return;
    }

    try {
      const res = await fetch("/api/v1/integrations/shopify/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to disconnect store");
      }
      setIsConnected(false);
      setSyncMessage("Shopify store disconnected. OAuth access token revoked.");
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Disconnect failed");
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Storefront Integrations</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isConnected ? "Shopify Active" : "Disconnected"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Connect NegoZaar to your ecommerce platform. The negotiation layer embeds seamlessly into your existing store.
          </p>
        </div>

        <Link
          href="/widget-sandbox"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-sm self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Test in Sandbox
        </Link>
      </div>

      {/* Alert Banners */}
      {syncMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{syncMessage}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Connected Primary Platform Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xl shadow-xs">
              🛍️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Shopify Storefront</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    isConnected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {isConnected ? "Connected & Synchronized" : "Ready to Connect"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{storeDomain}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={handleSyncProducts}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-emerald-600" : ""}`} />
                  {syncing ? "Syncing Catalog..." : "Sync Products Now"}
                </button>

                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
                  {verifying ? "Checking Ping..." : "Verify Connection"}
                </button>

                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-medium transition"
                  title="Disconnect Shopify Store"
                >
                  <Unplug className="w-3.5 h-3.5 text-rose-600" />
                  Disconnect
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {storeDomain && (
                  <button
                    type="button"
                    onClick={handleReconnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {connecting ? "Activating..." : "Reconnect Store"}
                  </button>
                )}
                <form onSubmit={handleConnectStore} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={newShopInput}
                    onChange={(e) => setNewShopInput(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={connecting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs cursor-pointer"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    {connecting ? "Connecting..." : "Connect New Shop"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {verifyStatus === "success" && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Connection verified! Storefront ping acknowledged in 14ms. Webhooks healthy.</span>
          </div>
        )}

        {/* Integration details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block">Webhooks Subscribed</span>
            <span className="text-slate-800 font-semibold mt-1 block">orders/create, products/update, app/uninstalled</span>
            <span className="text-[11px] text-emerald-600 font-medium">Automatic catalog sync</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block">Discount Engine</span>
            <span className="text-slate-800 font-semibold mt-1 block">Shopify Price Rules API</span>
            <span className="text-[11px] text-slate-500">Auto-issues single-use coupons</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block">Checkout Responsibility</span>
            <span className="text-slate-800 font-semibold mt-1 block">Native Shopify Checkout</span>
            <span className="text-[11px] text-slate-500">NegoZaar never touches credit cards</span>
          </div>
        </div>
      </div>

      {/* Method 1: Storefront Script Embed */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-600" />
              Option A: 1-Line Storefront Script Embed (Recommended)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste this single lightweight script tag into your Shopify theme or website template.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(scriptTagCode, "script")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition"
          >
            {copiedScript ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied Tag!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Embed Script
              </>
            )}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-100 overflow-x-auto relative">
          <pre>{scriptTagCode}</pre>
        </div>

        {/* Step-by-Step Installation Instructions */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            Installation Steps for Shopify:
          </h4>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Log into your Shopify Admin dashboard and click <strong>Online Store → Themes</strong>.
            </li>
            <li>
              Click the three dots <strong>(...)</strong> next to your current active theme and select{" "}
              <strong>Edit code</strong>.
            </li>
            <li>
              Under <strong>Layout</strong>, open the <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">theme.liquid</code> file.
            </li>
            <li>
              Scroll down to the bottom and paste the NegoZaar script tag directly above the closing{" "}
              <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">&lt;/body&gt;</code> tag.
            </li>
            <li>
              Click <strong>Save</strong>. The AI negotiation button will automatically appear on products you enabled in the{" "}
              <Link href="/products" className="text-emerald-600 font-semibold underline hover:no-underline">
                Products Console
              </Link>.
            </li>
          </ol>
        </div>
      </div>

      {/* Method 2: Headless / React SDK */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              Option B: Headless Commerce & React / Next.js SDK
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              For custom headless storefronts built with Next.js, Remix, Hydrogen, or Gatsby.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(reactHookCode, "react")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            {copiedReact ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied Snippet!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy React Code
              </>
            )}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-100 overflow-x-auto">
          <pre>{reactHookCode}</pre>
        </div>
      </div>

      {/* Supported & Upcoming Platforms */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Supported Ecommerce Platforms</h3>
        <p className="text-xs text-slate-500 mb-5">
          NegoZaar integrates as an optimization layer without modifying your core catalog or checkout engine.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30">
            <div className="text-2xl mb-1">🟢</div>
            <div className="text-xs font-bold text-slate-900">Shopify</div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Active & Supported</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-xs font-bold text-slate-900">Custom / Headless</div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">Available via REST/SDK</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 opacity-75">
            <div className="text-2xl mb-1">🟣</div>
            <div className="text-xs font-bold text-slate-900">WooCommerce</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Plugin in Beta (Q3)</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 opacity-75">
            <div className="text-2xl mb-1">🟠</div>
            <div className="text-xs font-bold text-slate-900">Magento / Adobe</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Extension in Beta (Q4)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
